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
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const supabase_js_1 = require("@supabase/supabase-js");
const api_key_entity_1 = require("./entities/api-key.entity");
const user_entity_1 = require("./entities/user.entity");
const logger_service_1 = require("../../common/services/logger.service");
let AuthService = class AuthService {
    apiKeyRepository;
    userRepository;
    logger = (0, logger_service_1.createLogger)('AuthService');
    supabase;
    constructor(apiKeyRepository, userRepository) {
        this.apiKeyRepository = apiKeyRepository;
        this.userRepository = userRepository;
        const supabaseUrl = process.env.SUPABASE_URL || '';
        const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
        if (!supabaseUrl || !supabaseKey) {
            this.logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY is not set');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    async onModuleInit() {
        this.logger.log('AuthService initialized with Supabase authentication.');
    }
    async validateSupabaseJwt(token) {
        const { data, error } = await this.supabase.auth.getUser(token);
        if (error || !data.user) {
            this.logger.warn(`Failed to validate Supabase JWT: ${error?.message}`);
            throw new common_1.UnauthorizedException('Invalid or expired token');
        }
        const sbUser = data.user;
        let user = await this.userRepository.findOne({ where: { supabaseId: sbUser.id } });
        if (!user) {
            user = this.userRepository.create({
                supabaseId: sbUser.id,
                email: sbUser.email || '',
            });
            user = await this.userRepository.save(user);
        }
        else if (user.email !== sbUser.email) {
            user.email = sbUser.email || '';
            await this.userRepository.save(user);
        }
        return user;
    }
    async getOrCreateApiKeyForUser(user) {
        let apiKey = await this.apiKeyRepository.findOne({ where: { userId: user.id }, relations: ['user'] });
        if (!apiKey) {
            apiKey = this.apiKeyRepository.create({
                name: `User ${user.email} Key`,
                user: user,
                userId: user.id,
                role: api_key_entity_1.ApiKeyRole.ADMIN,
                keyHash: user.supabaseId,
                keyPrefix: 'supa',
                isActive: true,
            });
            apiKey = await this.apiKeyRepository.save(apiKey);
        }
        return apiKey;
    }
    async validateApiKey(rawKey, clientIp, sessionId) {
        const masterKey = process.env.API_MASTER_KEY;
        if (masterKey && rawKey === masterKey) {
            const mockKey = new api_key_entity_1.ApiKey();
            mockKey.id = 'master';
            mockKey.name = 'Master Key';
            mockKey.role = api_key_entity_1.ApiKeyRole.ADMIN;
            mockKey.isActive = true;
            return mockKey;
        }
        const user = await this.validateSupabaseJwt(rawKey);
        return this.getOrCreateApiKeyForUser(user);
    }
    async createApiKey(dto) {
        throw new common_1.UnauthorizedException('API key creation is disabled. Using Supabase JWT.');
    }
    async findAll() {
        return this.apiKeyRepository.find({ order: { createdAt: 'DESC' } });
    }
    async findOne(id) {
        const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
        if (!apiKey)
            throw new common_1.NotFoundException(`API key not found`);
        return apiKey;
    }
    async update(id, dto) {
        throw new common_1.UnauthorizedException('API key modification is disabled. Using Supabase JWT.');
    }
    async delete(id) {
        throw new common_1.UnauthorizedException('API key deletion is disabled. Using Supabase JWT.');
    }
    async revoke(id) {
        throw new common_1.UnauthorizedException('API key revocation is disabled. Using Supabase JWT.');
    }
    hasPermission(apiKey, requiredRole) {
        const roleHierarchy = {
            [api_key_entity_1.ApiKeyRole.VIEWER]: 1,
            [api_key_entity_1.ApiKeyRole.OPERATOR]: 2,
            [api_key_entity_1.ApiKeyRole.ADMIN]: 3,
        };
        return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(api_key_entity_1.ApiKey, 'main')),
    __param(1, (0, typeorm_1.InjectRepository)(user_entity_1.User, 'main')),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository])
], AuthService);
//# sourceMappingURL=auth.service.js.map