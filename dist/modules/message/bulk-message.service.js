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
var BulkMessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkMessageService = void 0;
exports.resolveFinalBatchStatus = resolveFinalBatchStatus;
exports.sanitizeBatchError = sanitizeBatchError;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const crypto_1 = require("crypto");
const message_batch_entity_1 = require("./entities/message-batch.entity");
const message_entity_1 = require("./entities/message.entity");
const session_service_1 = require("../session/session.service");
const message_service_1 = require("./message.service");
const media_cap_util_1 = require("./media-cap.util");
const ssrf_guard_1 = require("../../common/security/ssrf-guard");
const template_render_1 = require("../../common/utils/template-render");
function resolveFinalBatchStatus(cancelled, stoppedOnError, progress) {
    if (cancelled)
        return message_batch_entity_1.BatchStatus.CANCELLED;
    if (stoppedOnError)
        return message_batch_entity_1.BatchStatus.FAILED;
    return progress.failed > 0 && progress.sent === 0 ? message_batch_entity_1.BatchStatus.FAILED : message_batch_entity_1.BatchStatus.COMPLETED;
}
function sanitizeBatchError(error) {
    if (error instanceof ssrf_guard_1.SsrfBlockedError) {
        return { code: 'SEND_BLOCKED', message: 'Destination address is not allowed' };
    }
    return { code: 'SEND_FAILED', message: error instanceof Error ? error.message : String(error) };
}
let BulkMessageService = BulkMessageService_1 = class BulkMessageService {
    batchRepository;
    sessionService;
    messageService;
    logger = new common_1.Logger(BulkMessageService_1.name);
    processingBatches = new Map();
    constructor(batchRepository, sessionService, messageService) {
        this.batchRepository = batchRepository;
        this.sessionService = sessionService;
        this.messageService = messageService;
    }
    async onApplicationBootstrap() {
        const orphaned = await this.batchRepository.find({ where: { status: message_batch_entity_1.BatchStatus.PROCESSING } });
        for (const batch of orphaned) {
            batch.status = message_batch_entity_1.BatchStatus.FAILED;
            await this.batchRepository.save(batch);
        }
        if (orphaned.length > 0) {
            this.logger.warn(`Marked ${orphaned.length} orphaned PROCESSING batch(es) FAILED on startup (interrupted by a restart)`);
        }
    }
    async createBatch(sessionId, dto) {
        const engine = this.sessionService.getEngine(sessionId);
        if (!engine) {
            throw new common_1.BadRequestException(`Session '${sessionId}' is not active`);
        }
        for (const { content } of dto.messages) {
            (0, media_cap_util_1.assertBase64WithinMediaCap)(content?.image?.base64);
            (0, media_cap_util_1.assertBase64WithinMediaCap)(content?.video?.base64);
            (0, media_cap_util_1.assertBase64WithinMediaCap)(content?.audio?.base64);
            (0, media_cap_util_1.assertBase64WithinMediaCap)(content?.document?.base64);
        }
        const batchId = dto.batchId || `batch_${(0, crypto_1.randomUUID)().split('-')[0]}`;
        const existing = await this.batchRepository.findOne({ where: { batchId } });
        if (existing) {
            throw new common_1.BadRequestException(`Batch ID '${batchId}' already exists`);
        }
        const options = {
            delayBetweenMessages: dto.options?.delayBetweenMessages ?? 3000,
            randomizeDelay: dto.options?.randomizeDelay ?? true,
            stopOnError: dto.options?.stopOnError ?? false,
        };
        const progress = {
            total: dto.messages.length,
            sent: 0,
            failed: 0,
            pending: dto.messages.length,
            cancelled: 0,
        };
        const batch = this.batchRepository.create({
            batchId,
            sessionId,
            status: message_batch_entity_1.BatchStatus.PENDING,
            messages: dto.messages,
            options,
            progress,
            results: [],
            currentIndex: 0,
        });
        await this.batchRepository.save(batch);
        this.logger.log(`Created batch ${batchId} with ${dto.messages.length} messages`);
        this.processBatch(batch.id).catch(err => {
            this.logger.error(`Batch ${batchId} processing error: ${String(err)}`);
        });
        return batch;
    }
    async getBatchStatus(sessionId, batchId) {
        const batch = await this.batchRepository.findOne({
            where: { batchId, sessionId },
        });
        if (!batch) {
            throw new common_1.NotFoundException(`Batch '${batchId}' not found`);
        }
        return batch;
    }
    async cancelBatch(sessionId, batchId) {
        const batch = await this.batchRepository.findOne({
            where: { batchId, sessionId },
        });
        if (!batch) {
            throw new common_1.NotFoundException(`Batch '${batchId}' not found`);
        }
        if (batch.status === message_batch_entity_1.BatchStatus.COMPLETED || batch.status === message_batch_entity_1.BatchStatus.CANCELLED) {
            throw new common_1.BadRequestException(`Batch '${batchId}' is already ${batch.status}`);
        }
        this.processingBatches.set(batch.id, false);
        batch.status = message_batch_entity_1.BatchStatus.CANCELLED;
        batch.progress.cancelled = batch.progress.pending;
        batch.progress.pending = 0;
        batch.completedAt = new Date();
        await this.batchRepository.save(batch);
        this.logger.log(`Cancelled batch ${batchId}`);
        return batch;
    }
    async processBatch(batchDbId) {
        const batch = await this.batchRepository.findOne({ where: { id: batchDbId } });
        if (!batch)
            return;
        this.processingBatches.set(batch.id, true);
        batch.status = message_batch_entity_1.BatchStatus.PROCESSING;
        batch.startedAt = new Date();
        await this.batchRepository.save(batch);
        const engine = this.sessionService.getEngine(batch.sessionId);
        if (!engine) {
            batch.status = message_batch_entity_1.BatchStatus.FAILED;
            batch.completedAt = new Date();
            await this.batchRepository.save(batch);
            return;
        }
        const results = batch.results || [];
        let stoppedOnError = false;
        let cancelledByDb = false;
        for (let i = batch.currentIndex; i < batch.messages.length; i++) {
            if (!this.processingBatches.get(batch.id)) {
                this.logger.log(`Batch ${batch.batchId} cancelled at index ${i}`);
                break;
            }
            const msg = batch.messages[i];
            const result = {
                chatId: msg.chatId,
                status: message_batch_entity_1.BatchMessageStatus.PENDING,
            };
            try {
                const content = this.applyVariables(msg.content, msg.variables);
                const messageResult = await this.sendMessage(engine, msg.chatId, msg.type, content);
                result.status = message_batch_entity_1.BatchMessageStatus.SENT;
                result.messageId = messageResult.id;
                result.sentAt = new Date();
                batch.progress.sent++;
                batch.progress.pending--;
                await this.persistSentMessage(batch.sessionId, msg.chatId, msg.type, content, messageResult);
                this.logger.debug(`Batch ${batch.batchId}: Sent message ${i + 1}/${batch.messages.length} to ${msg.chatId}`);
            }
            catch (error) {
                result.status = message_batch_entity_1.BatchMessageStatus.FAILED;
                const sanitized = sanitizeBatchError(error);
                result.error = sanitized;
                batch.progress.failed++;
                batch.progress.pending--;
                this.logger.warn(`Batch ${batch.batchId}: Failed message ${i + 1} to ${msg.chatId}: ${sanitized.message}`);
                if (batch.options.stopOnError) {
                    batch.status = message_batch_entity_1.BatchStatus.FAILED;
                    stoppedOnError = true;
                    results.push(result);
                    break;
                }
            }
            results.push(result);
            batch.currentIndex = i + 1;
            batch.results = results;
            if (i % 10 === 0 || i === batch.messages.length - 1) {
                const fresh = await this.batchRepository.findOne({ where: { id: batch.id }, select: ['status'] });
                if (fresh?.status === message_batch_entity_1.BatchStatus.CANCELLED) {
                    cancelledByDb = true;
                    this.logger.log(`Batch ${batch.batchId} cancelled (DB) at index ${i}`);
                    break;
                }
                await this.batchRepository.save(batch);
            }
            if (i < batch.messages.length - 1 && this.processingBatches.get(batch.id)) {
                const delay = this.calculateDelay(batch.options);
                await this.sleep(delay);
            }
        }
        if (!cancelledByDb) {
            const fresh = await this.batchRepository.findOne({ where: { id: batch.id }, select: ['status'] });
            if (fresh?.status === message_batch_entity_1.BatchStatus.CANCELLED) {
                cancelledByDb = true;
            }
        }
        const cancelled = cancelledByDb || !this.processingBatches.get(batch.id);
        batch.status = resolveFinalBatchStatus(cancelled, stoppedOnError, batch.progress);
        if (cancelled) {
            batch.progress.cancelled = batch.progress.pending;
            batch.progress.pending = 0;
        }
        batch.completedAt = new Date();
        batch.results = results;
        await this.batchRepository.save(batch);
        this.processingBatches.delete(batch.id);
        this.logger.log(`Batch ${batch.batchId} completed: ${batch.progress.sent} sent, ${batch.progress.failed} failed`);
    }
    applyVariables(content, variables) {
        if (!variables)
            return content;
        const replaceVars = (str) => (0, template_render_1.renderTemplate)(str, variables);
        const processValue = (value) => {
            if (typeof value === 'string') {
                return replaceVars(value);
            }
            if (Array.isArray(value)) {
                return value.map(processValue);
            }
            if (typeof value === 'object' && value !== null) {
                const result = {};
                for (const [k, v] of Object.entries(value)) {
                    result[k] = processValue(v);
                }
                return result;
            }
            return value;
        };
        return processValue(content);
    }
    async persistSentMessage(sessionId, chatId, type, content, result) {
        const media = content.image ?? content.video ?? content.audio ?? content.document;
        try {
            await this.messageService.saveOutgoingMessage(sessionId, {
                waMessageId: result.id,
                chatId,
                body: content.text ?? content.caption ?? '',
                type,
                timestamp: result.timestamp,
                status: message_entity_1.MessageStatus.SENT,
                metadata: media
                    ? {
                        media: {
                            mimetype: media.mimetype,
                            data: media.url ?? media.base64,
                            filename: content.document?.filename,
                        },
                    }
                    : undefined,
            });
        }
        catch (error) {
            this.logger.warn(`Batch message persisted-after-send failed: ${String(error)}`);
        }
    }
    sendMessage(engine, chatId, type, content) {
        switch (type) {
            case 'text':
                return engine.sendTextMessage(chatId, content.text || '');
            case 'image':
                return engine.sendImageMessage(chatId, {
                    mimetype: content.image?.mimetype || 'image/jpeg',
                    data: content.image?.url || content.image?.base64 || '',
                    caption: content.caption,
                });
            case 'video':
                return engine.sendVideoMessage(chatId, {
                    mimetype: content.video?.mimetype || 'video/mp4',
                    data: content.video?.url || content.video?.base64 || '',
                    caption: content.caption,
                });
            case 'audio':
                return engine.sendAudioMessage(chatId, {
                    mimetype: content.audio?.mimetype || 'audio/mpeg',
                    data: content.audio?.url || content.audio?.base64 || '',
                });
            case 'document':
                return engine.sendDocumentMessage(chatId, {
                    mimetype: content.document?.mimetype || 'application/octet-stream',
                    data: content.document?.url || content.document?.base64 || '',
                    filename: content.document?.filename,
                    caption: content.caption,
                });
            default:
                return Promise.reject(new Error(`Unsupported message type: ${type}`));
        }
    }
    calculateDelay(options) {
        let delay = options.delayBetweenMessages;
        if (options.randomizeDelay) {
            delay += Math.random() * 2000;
        }
        return delay;
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};
exports.BulkMessageService = BulkMessageService;
exports.BulkMessageService = BulkMessageService = BulkMessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(message_batch_entity_1.MessageBatch, 'data')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        session_service_1.SessionService,
        message_service_1.MessageService])
], BulkMessageService);
//# sourceMappingURL=bulk-message.service.js.map