import { Injectable, UnauthorizedException, OnModuleInit, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createClient, SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { ApiKey, ApiKeyRole } from './entities/api-key.entity';
import { User } from './entities/user.entity';
import { createLogger } from '../../common/services/logger.service';
import { CreateApiKeyDto, UpdateApiKeyDto } from './dto';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = createLogger('AuthService');
  private supabase: SupabaseClient;

  constructor(
    @InjectRepository(ApiKey, 'main')
    private readonly apiKeyRepository: Repository<ApiKey>,
    @InjectRepository(User, 'main')
    private readonly userRepository: Repository<User>,
  ) {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseKey) {
      this.logger.warn('SUPABASE_URL or SUPABASE_ANON_KEY is not set');
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log('AuthService initialized with Supabase authentication.');
  }

  async validateSupabaseJwt(token: string): Promise<User> {
    const { data, error } = await this.supabase.auth.getUser(token);
    
    if (error || !data.user) {
      this.logger.warn(`Failed to validate Supabase JWT: ${error?.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }

    const sbUser = data.user;
    
    // Upsert User into local DB to maintain relation
    let user = await this.userRepository.findOne({ where: { supabaseId: sbUser.id } });
    if (!user) {
      user = this.userRepository.create({
        supabaseId: sbUser.id,
        email: sbUser.email || '',
      });
      user = await this.userRepository.save(user);
    } else if (user.email !== sbUser.email) {
      user.email = sbUser.email || '';
      await this.userRepository.save(user);
    }

    return user;
  }

  async getOrCreateApiKeyForUser(user: User): Promise<ApiKey> {
    let apiKey = await this.apiKeyRepository.findOne({ where: { userId: user.id }, relations: ['user'] });
    if (!apiKey) {
      // Create a default API key for this user so legacy systems work
      apiKey = this.apiKeyRepository.create({
        name: `User ${user.email} Key`,
        user: user,
        userId: user.id,
        role: ApiKeyRole.ADMIN, // Default to admin for their own session
        keyHash: user.supabaseId, // Dummy hash
        keyPrefix: 'supa',
        isActive: true,
      });
      apiKey = await this.apiKeyRepository.save(apiKey);
    }
    return apiKey;
  }

  async validateApiKey(rawKey: string, clientIp?: string, sessionId?: string): Promise<ApiKey> {
    const masterKey = process.env.API_MASTER_KEY;
    if (masterKey && rawKey === masterKey) {
      // Mock an ApiKey entity for the master key
      const mockKey = new ApiKey();
      mockKey.id = 'master';
      mockKey.name = 'Master Key';
      mockKey.role = ApiKeyRole.ADMIN;
      mockKey.isActive = true;
      return mockKey;
    }
    const user = await this.validateSupabaseJwt(rawKey);
    return this.getOrCreateApiKeyForUser(user);
  }

  // --- Mock CRUD Methods for backward compatibility with AuthController ---

  async createApiKey(dto: CreateApiKeyDto): Promise<{ apiKey: ApiKey; rawKey: string }> {
    throw new UnauthorizedException('API key creation is disabled. Using Supabase JWT.');
  }

  async findAll(): Promise<ApiKey[]> {
    return this.apiKeyRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ApiKey> {
    const apiKey = await this.apiKeyRepository.findOne({ where: { id } });
    if (!apiKey) throw new NotFoundException(`API key not found`);
    return apiKey;
  }

  async update(id: string, dto: UpdateApiKeyDto): Promise<ApiKey> {
    throw new UnauthorizedException('API key modification is disabled. Using Supabase JWT.');
  }

  async delete(id: string): Promise<void> {
    throw new UnauthorizedException('API key deletion is disabled. Using Supabase JWT.');
  }

  async revoke(id: string): Promise<ApiKey> {
    throw new UnauthorizedException('API key revocation is disabled. Using Supabase JWT.');
  }

  hasPermission(apiKey: ApiKey, requiredRole: ApiKeyRole): boolean {
    const roleHierarchy: Record<ApiKeyRole, number> = {
      [ApiKeyRole.VIEWER]: 1,
      [ApiKeyRole.OPERATOR]: 2,
      [ApiKeyRole.ADMIN]: 3,
    };

    return roleHierarchy[apiKey.role] >= roleHierarchy[requiredRole];
  }
}
