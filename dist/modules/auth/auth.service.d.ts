import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';
export declare class AuthService implements OnModuleInit {
    private readonly apiKeyRepository;
    private readonly userRepository;
    private readonly logger;
    private supabase;
    constructor(apiKeyRepository: Repository<ApiKey>, userRepository: Repository<User>);
    onModuleInit(): Promise<void>;
    validateSupabaseJwt(token: string): Promise<User>;
    getOrCreateApiKeyForUser(user: User): Promise<ApiKey>;
    validateApiKey(rawKey: string, clientIp?: string, sessionId?: string): Promise<ApiKey>;
    createApiKey(dto: CreateApiKeyDto): Promise<{
        apiKey: ApiKey;
        rawKey: string;
    }>;
    findAll(): Promise<ApiKey[]>;
    findOne(id: string): Promise<ApiKey>;
    update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey>;
    delete(id: string): Promise<void>;
    revoke(id: string): Promise<ApiKey>;
    hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean;
}
