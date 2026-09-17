"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var SessionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionService = exports.ACK_RECONCILE_DELAY_MS = void 0;
exports.resolveReconnectConfig = resolveReconnectConfig;
exports.clampReconnectDelay = clampReconnectDelay;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("./entities/session.entity");
const message_entity_1 = require("../message/entities/message.entity");
const engine_factory_1 = require("../../engine/engine.factory");
const paginate_1 = require("../../common/utils/paginate");
const unique_constraint_util_1 = require("../../common/utils/unique-constraint.util");
const whatsapp_engine_interface_1 = require("../../engine/interfaces/whatsapp-engine.interface");
const logger_service_1 = require("../../common/services/logger.service");
const events_gateway_1 = require("../events/events.gateway");
const webhook_service_1 = require("../webhook/webhook.service");
const hooks_1 = require("../../core/hooks");
const message_status_util_1 = require("../message/message-status.util");
const RECONNECT_BASE_DELAY_MIN_MS = 1000;
const RECONNECT_BASE_DELAY_MAX_MS = 300_000;
const RECONNECT_MAX_ATTEMPTS_CAP = 20;
const RECONNECT_DELAY_CAP_MS = 3_600_000;
exports.ACK_RECONCILE_DELAY_MS = 750;
const clampNumber = (n, min, max) => Math.min(Math.max(n, min), max);
function resolveReconnectConfig(config) {
    const baseRaw = Number(config?.reconnectBaseDelay);
    const baseDelay = clampNumber(Number.isFinite(baseRaw) ? baseRaw : 5000, RECONNECT_BASE_DELAY_MIN_MS, RECONNECT_BASE_DELAY_MAX_MS);
    const attemptsRaw = Number(config?.maxReconnectAttempts);
    const maxAttempts = Math.floor(clampNumber(Number.isFinite(attemptsRaw) ? attemptsRaw : 5, 0, RECONNECT_MAX_ATTEMPTS_CAP));
    return { maxAttempts, baseDelay };
}
function clampReconnectDelay(rawDelay, baseDelay) {
    return clampNumber(Number.isFinite(rawDelay) ? rawDelay : baseDelay, 0, RECONNECT_DELAY_CAP_MS);
}
let SessionService = class SessionService {
    static { SessionService_1 = this; }
    sessionRepository;
    messageRepository;
    dataSource;
    engineFactory;
    eventsGateway;
    webhookService;
    hookManager;
    logger = (0, logger_service_1.createLogger)('SessionService');
    engines = new Map();
    lidPhoneCache = new Map();
    static LID_PHONE_CACHE_MAX = 5000;
    sessionErrors = new Map();
    reconnectStates = new Map();
    lastDispatchedStatus = new Map();
    stoppingSessions = new Set();
    initializingSessions = new Set();
    reactionChains = new Map();
    constructor(sessionRepository, messageRepository, dataSource, engineFactory, eventsGateway, webhookService, hookManager) {
        this.sessionRepository = sessionRepository;
        this.messageRepository = messageRepository;
        this.dataSource = dataSource;
        this.engineFactory = engineFactory;
        this.eventsGateway = eventsGateway;
        this.webhookService = webhookService;
        this.hookManager = hookManager;
    }
    async onModuleInit() {
        const activeStatuses = [
            session_entity_1.SessionStatus.READY,
            session_entity_1.SessionStatus.INITIALIZING,
            session_entity_1.SessionStatus.QR_READY,
            session_entity_1.SessionStatus.AUTHENTICATING,
        ];
        const result = await this.sessionRepository.update({ status: (0, typeorm_2.In)(activeStatuses) }, { status: session_entity_1.SessionStatus.DISCONNECTED });
        if (result.affected && result.affected > 0) {
            this.logger.log(`Reset ${result.affected} session(s) to disconnected on startup`, {
                action: 'startup_reset',
                affected: result.affected,
            });
        }
    }
    async onApplicationBootstrap() {
        if (process.env.AUTO_START_SESSIONS !== 'true')
            return;
        const sessions = await this.sessionRepository.find({
            where: { phone: (0, typeorm_2.Not)((0, typeorm_2.IsNull)()), status: session_entity_1.SessionStatus.DISCONNECTED },
        });
        if (sessions.length === 0)
            return;
        this.logger.log(`Auto-starting ${sessions.length} previously authenticated session(s)`, {
            action: 'auto_start',
            count: sessions.length,
        });
        for (let i = 0; i < sessions.length; i++) {
            const session = sessions[i];
            try {
                await this.start(session.id);
                this.logger.log(`Auto-started session: ${session.name}`, {
                    sessionId: session.id,
                    action: 'auto_start_success',
                });
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                this.logger.error(`Auto-start failed for session: ${session.name}`, errorMessage, {
                    sessionId: session.id,
                    action: 'auto_start_failed',
                });
            }
            if (i < sessions.length - 1) {
                await this.delay(2000);
            }
        }
    }
    async onModuleDestroy() {
        for (const [, state] of this.reconnectStates) {
            if (state.timer) {
                clearTimeout(state.timer);
            }
        }
        this.reconnectStates.clear();
        await Promise.allSettled([...this.engines].map(([sessionId, engine]) => this.destroyEngineSafely(sessionId, engine)));
        this.engines.clear();
    }
    async destroyEngineSafely(sessionId, engine) {
        this.logger.log(`Destroying engine for session ${sessionId}`, { sessionId, action: 'shutdown' });
        await this.teardownEngineSafely(sessionId, engine, e => e.destroy(), 'destroy');
    }
    async teardownEngineSafely(sessionId, engine, teardown, label) {
        let timer;
        try {
            await Promise.race([
                teardown(engine),
                new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error(`engine.${label}() timed out`)), 10_000);
                }),
            ]);
        }
        catch (err) {
            this.logger.error(`Failed to ${label} engine for session ${sessionId}`, String(err), {
                sessionId,
                action: `engine_${label}_failed`,
            });
        }
        finally {
            if (timer)
                clearTimeout(timer);
        }
    }
    async create(dto, ownerSupabaseId) {
        const existing = await this.sessionRepository.findOne({
            where: { name: dto.name },
        });
        if (existing) {
            throw new common_1.ConflictException(`Session with name '${dto.name}' already exists`);
        }
        if (ownerSupabaseId) {
            const existingForUser = await this.sessionRepository.findOne({ where: { ownerSupabaseId } });
            if (existingForUser) {
                throw new common_1.ConflictException(`User already has a session`);
            }
        }
        const session = this.sessionRepository.create({
            name: dto.name,
            config: dto.config || {},
            proxyUrl: dto.proxyUrl || null,
            proxyType: dto.proxyType || null,
            ownerSupabaseId: ownerSupabaseId || null,
            status: session_entity_1.SessionStatus.CREATED,
        });
        const saved = await this.dataSource.transaction(async (manager) => {
            return await manager.save(session);
        });
        this.logger.log(`Session created: ${saved.name}`, {
            sessionId: saved.id,
            action: 'create',
        });
        await this.hookManager.execute('session:created', saved, {
            sessionId: saved.id,
            source: 'SessionService',
        });
        return saved;
    }
    async findAll(allowedSessions, ownerSupabaseId) {
        const options = { order: { createdAt: 'DESC' } };
        const where = {};
        if (allowedSessions && allowedSessions.length > 0) {
            where.id = (0, typeorm_2.In)(allowedSessions);
        }
        if (ownerSupabaseId) {
            where.ownerSupabaseId = ownerSupabaseId;
        }
        if (Object.keys(where).length > 0) {
            options.where = where;
        }
        const sessions = await this.sessionRepository.find(options);
        return sessions.map(session => this.attachLastError(session));
    }
    async findOne(id) {
        const session = await this.sessionRepository.findOne({ where: { id } });
        if (!session) {
            throw new common_1.NotFoundException(`Session with id '${id}' not found`);
        }
        return this.attachLastError(session);
    }
    attachLastError(session) {
        session.lastError = session.status === session_entity_1.SessionStatus.FAILED ? this.sessionErrors.get(session.id) : undefined;
        return session;
    }
    async findByName(name) {
        const session = await this.sessionRepository.findOne({ where: { name } });
        if (!session) {
            throw new common_1.NotFoundException(`Session with name '${name}' not found`);
        }
        return session;
    }
    async delete(id) {
        const session = await this.findOne(id);
        this.stoppingSessions.add(id);
        this.cancelReconnect(id);
        try {
            const engine = this.engines.get(id);
            if (engine) {
                await this.teardownEngineSafely(id, engine, e => e.destroy(), 'destroy');
                this.engines.delete(id);
            }
            await this.hookManager.execute('session:deleted', {
                id: session.id,
                name: session.name,
                phone: session.phone,
                pushName: session.pushName,
            }, {
                sessionId: id,
                source: 'SessionService',
            });
            await this.dataSource.transaction(async (manager) => {
                await manager.remove(session);
            });
            this.logger.log(`Session deleted: ${session.name}`, {
                sessionId: id,
                action: 'delete',
            });
        }
        finally {
            this.stoppingSessions.delete(id);
            this.lastDispatchedStatus.delete(id);
        }
    }
    async start(id) {
        const session = await this.findOne(id);
        if (this.engines.has(id)) {
            if (session.status === session_entity_1.SessionStatus.DISCONNECTED || session.status === session_entity_1.SessionStatus.FAILED) {
                this.cancelReconnect(id);
                const oldEngine = this.engines.get(id);
                if (oldEngine) {
                    await this.teardownEngineSafely(id, oldEngine, e => e.destroy(), 'destroy');
                    this.engines.delete(id);
                }
            }
            else {
                throw new common_1.BadRequestException('Session is already started');
            }
        }
        if (this.initializingSessions.has(id)) {
            throw new common_1.BadRequestException('Session is already starting');
        }
        this.initializingSessions.add(id);
        try {
            this.stoppingSessions.delete(id);
            await this.hookManager.execute('session:starting', { sessionId: id }, {
                sessionId: id,
                source: 'SessionService',
            });
            const { maxAttempts, baseDelay } = resolveReconnectConfig(session.config);
            this.reconnectStates.set(id, { attempts: 0, timer: null, maxAttempts, baseDelay });
            await this.initializeEngine(id, session);
            if (this.stoppingSessions.has(id)) {
                const resurrected = this.engines.get(id);
                if (resurrected) {
                    await this.teardownEngineSafely(id, resurrected, e => e.destroy(), 'destroy');
                    this.engines.delete(id);
                }
            }
            return this.findOne(id);
        }
        finally {
            this.initializingSessions.delete(id);
        }
    }
    isLiveEngine(id, engine) {
        return this.engines.get(id) === engine;
    }
    async persistHistoryMessages(id, messages) {
        const byId = new Map();
        for (const m of messages) {
            if (m.id && !m.isStatusBroadcast && m.chatId && m.from && m.to) {
                byId.set(m.id, m);
            }
        }
        if (byId.size === 0) {
            return;
        }
        const ids = [...byId.keys()];
        const CHUNK = 400;
        let inserted = 0;
        for (let i = 0; i < ids.length; i += CHUNK) {
            const chunkIds = ids.slice(i, i + CHUNK);
            const existing = await this.messageRepository.find({
                where: { sessionId: id, waMessageId: (0, typeorm_2.In)(chunkIds) },
                select: ['waMessageId'],
            });
            const seen = new Set(existing.map(r => r.waMessageId));
            const rows = chunkIds
                .filter(x => !seen.has(x))
                .map(x => {
                const m = byId.get(x);
                const metadata = {};
                if (m.media)
                    metadata.media = m.media;
                if (m.quotedMessage)
                    metadata.quotedMessage = m.quotedMessage;
                const row = this.messageRepository.create({
                    sessionId: id,
                    waMessageId: m.id,
                    chatId: m.chatId,
                    from: m.from,
                    to: m.to,
                    body: m.body,
                    type: m.type,
                    direction: m.fromMe ? message_entity_1.MessageDirection.OUTGOING : message_entity_1.MessageDirection.INCOMING,
                    timestamp: m.timestamp,
                    status: message_entity_1.MessageStatus.SENT,
                    metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                });
                if (m.timestamp) {
                    row.createdAt = new Date(m.timestamp * 1000);
                }
                return row;
            });
            if (rows.length) {
                await this.messageRepository
                    .createQueryBuilder()
                    .insert()
                    .values(rows)
                    .orIgnore()
                    .execute();
                inserted += rows.length;
            }
        }
        if (inserted) {
            this.logger.log(`Persisted ${inserted} history message(s)`, {
                sessionId: id,
                inserted,
                action: 'history_messages_persisted',
            });
        }
    }
    async initializeEngine(id, session) {
        this.logger.log(`Initializing engine for session: ${session.name}`, {
            sessionId: id,
            action: 'engine_init',
            proxyEnabled: !!session.proxyUrl,
        });
        const engine = this.engineFactory.create({
            sessionId: session.name,
            proxyUrl: session.proxyUrl || undefined,
            proxyType: session.proxyType || undefined,
        });
        this.engines.set(id, engine);
        this.sessionErrors.delete(id);
        await this.updateStatus(id, session_entity_1.SessionStatus.INITIALIZING);
        await engine.initialize({
            onQRCode: (qr) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.log('QR code generated', {
                    sessionId: id,
                    action: 'qr_generated',
                });
                void this.webhookService.dispatch(id, 'session.qr', { sessionId: id, qr });
                this.eventsGateway.emitQRCode(id, qr);
                void this.hookManager.execute('session:qr', { sessionId: id }, {
                    sessionId: id,
                    source: 'Engine',
                });
                void this.updateStatus(id, session_entity_1.SessionStatus.QR_READY);
            },
            onReady: (phone, pushName) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.log(`Session ready: ${phone}`, {
                    sessionId: id,
                    phone,
                    pushName,
                    action: 'ready',
                });
                void this.webhookService.dispatch(id, 'session.authenticated', { sessionId: id, phone, pushName });
                this.eventsGateway.emitSessionAuthenticated(id, { phone, pushName });
                void this.hookManager.execute('session:ready', { phone, pushName }, {
                    sessionId: id,
                    source: 'Engine',
                });
                const reconnectState = this.reconnectStates.get(id);
                if (reconnectState) {
                    reconnectState.attempts = 0;
                }
                this.sessionErrors.delete(id);
                void this.sessionRepository.update(id, {
                    status: session_entity_1.SessionStatus.READY,
                    phone,
                    pushName,
                    connectedAt: new Date(),
                    lastActiveAt: new Date(),
                });
            },
            onMessage: (message) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                if (message.isStatusBroadcast) {
                    return;
                }
                this.logger.debug(`Message received from ${message.from}`, {
                    sessionId: id,
                    messageId: message.id,
                    from: message.from,
                    action: 'message_received',
                });
                void this.sessionRepository.update(id, { lastActiveAt: new Date() });
                const messageData = { ...message };
                void this.hookManager
                    .execute('message:received', messageData, {
                    sessionId: id,
                    source: 'Engine',
                })
                    .then(async ({ continue: shouldContinue, data: finalMessage }) => {
                    if (!shouldContinue) {
                        return;
                    }
                    const incoming = finalMessage;
                    if (process.env.RESOLVE_LID_TO_PHONE === 'true' && incoming.isLidSender && !incoming.fromMe) {
                        incoming.senderPhone = await this.resolveSenderPhone(id, incoming.author ?? incoming.from);
                    }
                    const metadata = {};
                    if (incoming.media) {
                        metadata.media = incoming.media;
                    }
                    if (incoming.quotedMessage) {
                        metadata.quotedMessage = incoming.quotedMessage;
                    }
                    const dbMessage = this.messageRepository.create({
                        sessionId: id,
                        waMessageId: incoming.id,
                        chatId: incoming.chatId,
                        from: incoming.from,
                        to: incoming.to,
                        body: incoming.body,
                        type: incoming.type,
                        direction: incoming.fromMe ? message_entity_1.MessageDirection.OUTGOING : message_entity_1.MessageDirection.INCOMING,
                        timestamp: incoming.timestamp,
                        status: message_entity_1.MessageStatus.SENT,
                        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                    });
                    let isNewMessage = true;
                    try {
                        await this.messageRepository.insert(dbMessage);
                    }
                    catch (err) {
                        if ((0, unique_constraint_util_1.isUniqueConstraintError)(err)) {
                            isNewMessage = false;
                        }
                        else {
                            this.logger.error(`Failed to save incoming message ${incoming.id} to database`, String(err));
                        }
                    }
                    if (!isNewMessage) {
                        return;
                    }
                    void this.webhookService.dispatch(id, 'message.received', finalMessage);
                    this.eventsGateway.emitMessage(id, finalMessage);
                })
                    .catch(err => this.logger.error(`onMessage handler failed for ${id}`, String(err)));
            },
            onHistoryMessages: (messages) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                void this.persistHistoryMessages(id, messages).catch(err => this.logger.error(`Failed to persist history messages for ${id}`, String(err)));
            },
            onMessageCreate: (message) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                if (!message.fromMe) {
                    return;
                }
                if (message.isStatusBroadcast) {
                    return;
                }
                this.logger.debug(`Message sent to ${message.to}`, {
                    sessionId: id,
                    messageId: message.id,
                    to: message.to,
                    action: 'message_sent',
                });
                void this.sessionRepository.update(id, { lastActiveAt: new Date() });
                const messageData = { ...message };
                void this.hookManager
                    .execute('message:sent', messageData, {
                    sessionId: id,
                    source: 'Engine',
                })
                    .then(({ continue: shouldContinue, data: finalMessage }) => {
                    if (!shouldContinue) {
                        return;
                    }
                    void this.webhookService.dispatch(id, 'message.sent', finalMessage);
                    this.eventsGateway.emitMessageSent(id, finalMessage);
                })
                    .catch(err => this.logger.error(`onMessageCreate handler failed for ${id}`, String(err)));
            },
            onMessageAck: (messageId, status) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.debug(`Message ack: ${messageId} -> ${status}`, {
                    sessionId: id,
                    messageId,
                    status,
                    action: 'message_ack',
                });
                const messageStatus = (0, message_status_util_1.deliveryStatusToMessageStatus)(status);
                if (messageStatus) {
                    const advanceAck = () => this.messageRepository
                        .update({ sessionId: id, waMessageId: messageId, status: (0, typeorm_2.In)((0, message_status_util_1.ackStatusTransitionFrom)(messageStatus)) }, { status: messageStatus })
                        .then(result => result.affected ?? 0);
                    const logNoop = () => this.logger.debug(`Message ack ${messageId}: no status row advanced to ${messageStatus} (${status})`, {
                        sessionId: id,
                        messageId,
                        status,
                        action: 'message_ack_noop',
                    });
                    const onAckError = (err) => this.logger.error(`Failed to advance ack for ${messageId}`, String(err));
                    void advanceAck()
                        .then(affected => {
                        if (affected > 0)
                            return;
                        const timer = setTimeout(() => {
                            void advanceAck()
                                .then(retried => {
                                if (retried === 0)
                                    logNoop();
                            })
                                .catch(onAckError);
                        }, exports.ACK_RECONCILE_DELAY_MS);
                        timer.unref?.();
                    })
                        .catch(onAckError);
                }
                const ackPayload = { id: messageId, messageId, status, ack: (0, message_status_util_1.deliveryStatusToAck)(status) };
                this.eventsGateway.emitMessageAck(id, ackPayload);
                void this.webhookService.dispatch(id, 'message.ack', ackPayload);
                if (status === 'failed') {
                    void this.webhookService.dispatch(id, 'message.failed', { ...ackPayload });
                }
                void this.hookManager.execute('message:ack', { messageId, status, ack: (0, message_status_util_1.deliveryStatusToAck)(status) }, { sessionId: id, source: 'Engine' });
            },
            onMessageRevoked: (message) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.debug(`Message revoked: ${message.id}`, {
                    sessionId: id,
                    messageId: message.id,
                    action: 'message_revoked',
                });
                void this.messageRepository
                    .update({ sessionId: id, waMessageId: message.id }, { body: '', type: 'revoked' })
                    .catch(err => {
                    this.logger.error(`Failed to update revoked message: ${message.id}`, String(err));
                });
                const revokedPayload = message;
                void this.webhookService.dispatch(id, 'message.revoked', revokedPayload);
                this.eventsGateway.emitMessageRevoked(id, revokedPayload);
            },
            onMessageReaction: (event) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.debug(`Message reaction received: ${event.messageId} -> ${event.reaction}`, {
                    sessionId: id,
                    messageId: event.messageId,
                    action: 'message_reaction_received',
                });
                const key = `${id}:${event.messageId}`;
                const prior = this.reactionChains.get(key) ?? Promise.resolve();
                const next = prior.catch(() => undefined).then(() => this.applyReaction(id, event));
                this.reactionChains.set(key, next);
                void next.finally(() => {
                    if (this.reactionChains.get(key) === next) {
                        this.reactionChains.delete(key);
                    }
                });
            },
            onDisconnected: (reason) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.warn(`Session disconnected: ${reason}`, {
                    sessionId: id,
                    reason,
                    action: 'disconnected',
                });
                void this.webhookService.dispatch(id, 'session.disconnected', { sessionId: id, reason });
                this.eventsGateway.emitSessionDisconnected(id, { reason });
                void this.hookManager.execute('session:disconnected', { reason }, {
                    sessionId: id,
                    source: 'Engine',
                });
                void this.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
                this.scheduleReconnect(id, session);
            },
            onStateChanged: (engineState) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                const statusMap = {
                    [whatsapp_engine_interface_1.EngineStatus.DISCONNECTED]: session_entity_1.SessionStatus.DISCONNECTED,
                    [whatsapp_engine_interface_1.EngineStatus.INITIALIZING]: session_entity_1.SessionStatus.INITIALIZING,
                    [whatsapp_engine_interface_1.EngineStatus.QR_READY]: session_entity_1.SessionStatus.QR_READY,
                    [whatsapp_engine_interface_1.EngineStatus.AUTHENTICATING]: session_entity_1.SessionStatus.AUTHENTICATING,
                    [whatsapp_engine_interface_1.EngineStatus.READY]: session_entity_1.SessionStatus.READY,
                    [whatsapp_engine_interface_1.EngineStatus.FAILED]: session_entity_1.SessionStatus.FAILED,
                };
                const newStatus = statusMap[engineState];
                if (newStatus) {
                    void this.updateStatus(id, newStatus);
                }
            },
            onError: (reason) => {
                if (!this.isLiveEngine(id, engine))
                    return;
                this.logger.error(`Session engine failed: ${reason}`, undefined, {
                    sessionId: id,
                    reason,
                    action: 'engine_error',
                });
                this.sessionErrors.set(id, reason);
                this.cancelReconnect(id);
                void this.hookManager.execute('session:error', { reason }, {
                    sessionId: id,
                    source: 'Engine',
                });
                void this.updateStatus(id, session_entity_1.SessionStatus.FAILED);
            },
        });
    }
    async applyReaction(id, event) {
        try {
            const msg = await this.messageRepository.findOne({ where: { sessionId: id, waMessageId: event.messageId } });
            if (!msg)
                return;
            const metadata = msg.metadata || {};
            const reactions = metadata.reactions || {};
            if (!event.reaction) {
                delete reactions[event.senderId];
            }
            else {
                reactions[event.senderId] = event.reaction;
            }
            metadata.reactions = reactions;
            msg.metadata = metadata;
            await this.messageRepository.save(msg);
            this.eventsGateway.emitMessageReaction(id, { ...event, reactions });
            void this.webhookService.dispatch(id, 'message.reaction', { ...event, reactions });
        }
        catch (err) {
            this.logger.error(`Failed to update message reaction: ${event.messageId}`, String(err));
        }
    }
    scheduleReconnect(id, session) {
        const state = this.reconnectStates.get(id);
        if (!state)
            return;
        if (state.attempts >= state.maxAttempts) {
            this.logger.error(`Max reconnect attempts reached for session: ${session.name}`, undefined, {
                sessionId: id,
                attempts: state.attempts,
                action: 'reconnect_failed',
            });
            this.sessionErrors.set(id, `Reconnection failed after ${state.attempts} attempts — restart the session.`);
            void this.updateStatus(id, session_entity_1.SessionStatus.FAILED);
            return;
        }
        const delay = clampReconnectDelay(state.baseDelay * Math.pow(2, state.attempts) + Math.random() * 1000, state.baseDelay);
        state.attempts++;
        this.logger.log(`Scheduling reconnect attempt ${state.attempts}/${state.maxAttempts} in ${Math.round(delay / 1000)}s`, {
            sessionId: id,
            attempt: state.attempts,
            delayMs: delay,
            action: 'reconnect_scheduled',
        });
        if (state.timer)
            clearTimeout(state.timer);
        state.timer = setTimeout(() => {
            void this.executeReconnect(id, session, state);
        }, delay);
    }
    async executeReconnect(id, session, state) {
        if (this.stoppingSessions.has(id)) {
            return;
        }
        try {
            const oldEngine = this.engines.get(id);
            if (oldEngine) {
                await this.teardownEngineSafely(id, oldEngine, e => e.destroy(), 'destroy');
                this.engines.delete(id);
            }
            await this.initializeEngine(id, session);
            if (this.stoppingSessions.has(id)) {
                const resurrected = this.engines.get(id);
                if (resurrected) {
                    await this.teardownEngineSafely(id, resurrected, e => e.destroy(), 'destroy');
                    this.engines.delete(id);
                }
                return;
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.logger.error(`Reconnect attempt ${state.attempts} failed`, errorMessage, {
                sessionId: id,
                action: 'reconnect_error',
            });
            this.scheduleReconnect(id, session);
        }
    }
    cancelReconnect(id) {
        const state = this.reconnectStates.get(id);
        if (state?.timer) {
            clearTimeout(state.timer);
            state.timer = null;
        }
        this.reconnectStates.delete(id);
    }
    async stop(id) {
        const session = await this.findOne(id);
        this.stoppingSessions.add(id);
        this.cancelReconnect(id);
        const engine = this.engines.get(id);
        if (engine) {
            await this.teardownEngineSafely(id, engine, e => e.disconnect(), 'disconnect');
            this.engines.delete(id);
        }
        this.logger.log(`Session stopped: ${session.name}`, {
            sessionId: id,
            action: 'stop',
        });
        await this.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
        return this.findOne(id);
    }
    async forceKill(id) {
        const session = await this.findOne(id);
        this.stoppingSessions.add(id);
        this.cancelReconnect(id);
        const engine = this.engines.get(id);
        if (engine) {
            await this.teardownEngineSafely(id, engine, e => e.forceDestroy(), 'force-destroy');
            this.engines.delete(id);
        }
        this.logger.warn(`Session force-killed: ${session.name}`, {
            sessionId: id,
            action: 'force_kill',
        });
        await this.updateStatus(id, session_entity_1.SessionStatus.DISCONNECTED);
        return this.findOne(id);
    }
    async getQRCode(id) {
        const session = await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started. Call POST /sessions/:id/start first.');
        }
        const qrCode = engine.getQRCode();
        if (!qrCode) {
            if (session.status === session_entity_1.SessionStatus.READY) {
                throw new common_1.BadRequestException('Session is already authenticated, no QR code needed');
            }
            throw new common_1.BadRequestException('QR code is not ready yet. Please wait...');
        }
        return {
            qrCode,
            status: session.status,
        };
    }
    async requestPairingCode(id, phoneNumber) {
        const session = await this.findOne(id);
        let engine = this.engines.get(id);
        if (!engine) {
            this.logger.log(`Session ${id} not active. Auto-starting session for pairing code request...`);
            await this.start(id);
            engine = this.engines.get(id);
        }
        if (!engine) {
            throw new common_1.BadRequestException('Session engine could not be started. Please try starting the session manually first.');
        }
        if (session.status === session_entity_1.SessionStatus.READY) {
            throw new common_1.BadRequestException('Session is already authenticated and connected.');
        }
        const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
        if (!cleanPhone || cleanPhone.length < 10) {
            throw new common_1.BadRequestException('Invalid phone number. Provide country code + 10-digit number (e.g. 919561485909)');
        }
        try {
            const pairingCode = await engine.requestPairingCode(cleanPhone);
            return { pairingCode, status: session.status };
        }
        catch (err) {
            this.logger.error(`Pairing code generation error for session ${id}: ${err.message}`, err.stack);
            throw new common_1.BadRequestException(err.message || 'Failed to request WhatsApp pairing code.');
        }
    }
    getEngine(id) {
        return this.engines.get(id);
    }
    async resolveSenderPhone(sessionId, contactId) {
        const key = `${sessionId}:${contactId}`;
        const cached = this.lidPhoneCache.get(key);
        if (cached !== undefined) {
            return cached;
        }
        let phone;
        try {
            phone = (await this.getEngine(sessionId)?.resolveContactPhone(contactId)) ?? null;
        }
        catch {
            phone = null;
        }
        if (this.lidPhoneCache.size >= SessionService_1.LID_PHONE_CACHE_MAX) {
            for (const oldest of this.lidPhoneCache.keys()) {
                this.lidPhoneCache.delete(oldest);
                break;
            }
        }
        this.lidPhoneCache.set(key, phone);
        return phone;
    }
    async getGroups(id, opts = {}) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        const groups = await engine.getGroups();
        const mapped = groups.map(g => ({
            id: g.id,
            name: g.name,
            linkedParentJID: g.linkedParentJID,
        }));
        return (0, paginate_1.paginate)(mapped, opts.limit, opts.offset);
    }
    async getChats(id, opts = {}) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        const chats = [...(await engine.getChats())].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return (0, paginate_1.paginate)(chats, opts.limit, opts.offset);
    }
    async sendSeen(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.sendSeen(chatId);
    }
    async markUnread(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.markUnread(chatId);
    }
    async deleteChat(id, chatId) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        return engine.deleteChat(chatId);
    }
    async sendChatState(id, chatId, state) {
        await this.findOne(id);
        const engine = this.engines.get(id);
        if (!engine) {
            throw new common_1.BadRequestException('Session is not started');
        }
        await engine.sendChatState(chatId, state);
    }
    async updateStatus(id, status) {
        await this.sessionRepository.update(id, { status });
        this.logger.debug(`Session status updated to ${status}`, {
            sessionId: id,
            status,
            action: 'status_update',
        });
        this.eventsGateway.emitSessionStatus(id, status);
        if (this.lastDispatchedStatus.get(id) !== status) {
            this.lastDispatchedStatus.set(id, status);
            void this.webhookService.dispatch(id, 'session.status', { sessionId: id, status });
        }
    }
    async getStats(allowedSessions) {
        const scope = allowedSessions && allowedSessions.length > 0 ? allowedSessions : null;
        const sessions = await this.findAll(scope);
        const byStatus = {};
        for (const session of sessions) {
            byStatus[session.status] = (byStatus[session.status] || 0) + 1;
        }
        const memory = process.memoryUsage();
        return {
            total: sessions.length,
            active: scope ? [...this.engines.keys()].filter(id => scope.includes(id)).length : this.engines.size,
            ready: byStatus[session_entity_1.SessionStatus.READY] || 0,
            disconnected: byStatus[session_entity_1.SessionStatus.DISCONNECTED] || 0,
            byStatus,
            memoryUsage: {
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
                heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
                rss: Math.round(memory.rss / 1024 / 1024),
            },
        };
    }
    getActiveCount() {
        return this.engines.size;
    }
    isActive(id) {
        return this.engines.has(id);
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.SessionService = SessionService;
exports.SessionService = SessionService = SessionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __param(1, (0, typeorm_1.InjectRepository)(message_entity_1.Message, 'data')),
    __param(2, (0, typeorm_1.InjectDataSource)('data')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.DataSource,
        engine_factory_1.EngineFactory,
        events_gateway_1.EventsGateway,
        webhook_service_1.WebhookService,
        hooks_1.HookManager])
], SessionService);
//# sourceMappingURL=session.service.js.map