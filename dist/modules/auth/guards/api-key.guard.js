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
exports.ApiKeyGuard = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const auth_service_1 = require("../auth.service");
const api_key_entity_1 = require("../entities/api-key.entity");
const auth_decorators_1 = require("../decorators/auth.decorators");
let ApiKeyGuard = class ApiKeyGuard {
    authService;
    reflector;
    configService;
    constructor(authService, reflector, configService) {
        this.authService = authService;
        this.reflector = reflector;
        this.configService = configService;
    }
    async canActivate(context) {
        const isPublic = this.reflector.getAllAndOverride(auth_decorators_1.PUBLIC_KEY, [context.getHandler(), context.getClass()]);
        if (isPublic) {
            return true;
        }
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);
        if (!token) {
            throw new common_1.UnauthorizedException('Bearer token (JWT) is required');
        }
        const requiredRole = this.reflector.getAllAndOverride(auth_decorators_1.REQUIRED_ROLE_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const masterKey = this.configService.get('API_MASTER_KEY');
        if (masterKey && token === masterKey) {
            const dummyAdminUser = { id: 'admin-bypass', role: 'admin' };
            request.user = dummyAdminUser;
            request.apiKey = { role: api_key_entity_1.ApiKeyRole.ADMIN, key: masterKey };
            return true;
        }
        const user = await this.authService.validateSupabaseJwt(token);
        const apiKey = await this.authService.getOrCreateApiKeyForUser(user);
        if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
            throw new common_1.ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
        }
        request.user = user;
        request.apiKey = apiKey;
        return true;
    }
    extractToken(request) {
        const authHeader = request.headers['authorization'];
        if (authHeader?.startsWith('Bearer ')) {
            return authHeader.substring(7);
        }
        const xApiKey = request.headers['x-api-key'];
        if (xApiKey)
            return xApiKey;
        return undefined;
    }
};
exports.ApiKeyGuard = ApiKeyGuard;
exports.ApiKeyGuard = ApiKeyGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        core_1.Reflector,
        config_1.ConfigService])
], ApiKeyGuard);
//# sourceMappingURL=api-key.guard.js.map