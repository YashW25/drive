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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeartbeatMiddleware = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const heartbeat_service_1 = require("./heartbeat.service");
let HeartbeatMiddleware = class HeartbeatMiddleware {
    configService;
    heartbeatService;
    route;
    enabled;
    constructor(configService, heartbeatService) {
        this.configService = configService;
        this.heartbeatService = heartbeatService;
        this.route = this.configService.get('HEARTBEAT_ROUTE') ?? '/api/heartbeat';
        this.enabled = this.configService.get('HEARTBEAT_ENABLED') !== 'false';
    }
    use(req, res, next) {
        if (this.enabled && req.path === this.route && req.method === 'GET') {
            const state = this.heartbeatService.getCachedState();
            if (!state) {
                return res.status(503).json({ status: 'starting' });
            }
            return res.status(200).json({
                ...state,
                timestamp: new Date().toISOString()
            });
        }
        next();
    }
};
exports.HeartbeatMiddleware = HeartbeatMiddleware;
exports.HeartbeatMiddleware = HeartbeatMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        heartbeat_service_1.HeartbeatService])
], HeartbeatMiddleware);
//# sourceMappingURL=heartbeat.middleware.js.map