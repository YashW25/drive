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
var HeartbeatService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeartbeatService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const engine_factory_1 = require("../../engine/engine.factory");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const session_entity_1 = require("../session/entities/session.entity");
const { version: APP_VERSION } = require('../../../package.json');
let HeartbeatService = HeartbeatService_1 = class HeartbeatService {
    configService;
    engineFactory;
    sessionRepository;
    logger = new common_1.Logger(HeartbeatService_1.name);
    timer;
    cachedState = null;
    isEnabled;
    loggingEnabled;
    showMemory;
    showUptime;
    showVersion;
    startTime;
    constructor(configService, engineFactory, sessionRepository) {
        this.configService = configService;
        this.engineFactory = engineFactory;
        this.sessionRepository = sessionRepository;
        this.isEnabled = this.configService.get('HEARTBEAT_ENABLED') !== 'false';
        this.loggingEnabled = this.configService.get('HEARTBEAT_LOGGING') === 'true';
        this.showMemory = this.configService.get('HEARTBEAT_SHOW_MEMORY') !== 'false';
        this.showUptime = this.configService.get('HEARTBEAT_SHOW_UPTIME') !== 'false';
        this.showVersion = this.configService.get('HEARTBEAT_SHOW_VERSION') !== 'false';
        this.startTime = Date.now();
    }
    async onModuleInit() {
        if (this.isEnabled) {
            await this.updateCache();
            this.timer = setInterval(() => {
                this.updateCache().catch(err => this.logger.error('Heartbeat cache update failed', err));
            }, 30000);
            this.timer.unref();
        }
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
    async updateCache() {
        let sessionName = 'default';
        let isConnected = false;
        try {
            const activeSession = await this.sessionRepository.findOne({
                order: { lastActiveAt: 'DESC' },
            });
            if (activeSession) {
                sessionName = activeSession.name;
                isConnected = activeSession.status === session_entity_1.SessionStatus.READY;
            }
        }
        catch (e) {
        }
        const memory = process.memoryUsage();
        this.cachedState = {
            status: isConnected ? 'alive' : 'degraded',
            service: 'OpenWA Lite',
            engine: this.engineFactory.getCurrentEngine(),
            connected: isConnected,
            session: sessionName,
            ...(this.showUptime && { uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000) }),
            ...(this.showMemory && { memoryMB: Math.round(memory.rss / 1024 / 1024) }),
            ...(this.showVersion && { version: APP_VERSION }),
        };
        if (this.loggingEnabled) {
            this.logger.log(`[Heartbeat] Status: ${this.cachedState.status} | Memory: ${this.cachedState.memoryMB}MB | Connection: ${this.cachedState.connected}`);
        }
    }
    getCachedState() {
        return this.cachedState;
    }
};
exports.HeartbeatService = HeartbeatService;
exports.HeartbeatService = HeartbeatService = HeartbeatService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, typeorm_1.InjectRepository)(session_entity_1.Session, 'data')),
    __metadata("design:paramtypes", [config_1.ConfigService,
        engine_factory_1.EngineFactory,
        typeorm_2.Repository])
], HeartbeatService);
//# sourceMappingURL=heartbeat.service.js.map