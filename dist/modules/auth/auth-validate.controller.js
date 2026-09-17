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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthValidateController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const auth_service_1 = require("./auth.service");
const logger_service_1 = require("../../common/services/logger.service");
let AuthValidateController = class AuthValidateController {
    authService;
    logger = (0, logger_service_1.createLogger)('AuthValidateController');
    constructor(authService) {
        this.authService = authService;
    }
    async validate(apiKey) {
        if (!apiKey) {
            return { valid: false };
        }
        try {
            const keyEntity = await this.authService.validateApiKey(apiKey);
            if (keyEntity && keyEntity.isActive) {
                return { valid: true, role: keyEntity.role };
            }
            return { valid: false };
        }
        catch (error) {
            this.logger.warn('API key validation error', { error: error instanceof Error ? error.message : String(error) });
            return { valid: false };
        }
    }
};
exports.AuthValidateController = AuthValidateController;
__decorate([
    (0, common_1.Post)('validate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Validate an API key' }),
    (0, swagger_1.ApiHeader)({ name: 'X-API-Key', description: 'API key to validate' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'API key is valid' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or missing API key' }),
    __param(0, (0, common_1.Headers)('x-api-key')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthValidateController.prototype, "validate", null);
exports.AuthValidateController = AuthValidateController = __decorate([
    (0, swagger_1.ApiTags)('auth'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthValidateController);
//# sourceMappingURL=auth-validate.controller.js.map