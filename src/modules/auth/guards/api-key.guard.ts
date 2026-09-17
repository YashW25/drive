import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { ApiKeyRole } from '../entities/api-key.entity';
import { REQUIRED_ROLE_KEY, PUBLIC_KEY, SESSION_SCOPED_KEY } from '../decorators/auth.decorators';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedException('Bearer token (JWT) is required');
    }

    const requiredRole = this.reflector.getAllAndOverride<ApiKeyRole>(REQUIRED_ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Backward compatibility: If the token matches API_MASTER_KEY, allow full access.
    const masterKey = this.configService.get<string>('API_MASTER_KEY');
    if (masterKey && token === masterKey) {
      const dummyAdminUser = { id: 'admin-bypass', role: 'admin' };
      (request as any).user = dummyAdminUser;
      (request as any).apiKey = { role: ApiKeyRole.ADMIN, key: masterKey };
      return true;
    }

    // Validate Supabase JWT and get the User entity
    const user = await this.authService.validateSupabaseJwt(token);

    // Ensure the user has an API Key provisioned (this effectively provisions one if missing)
    const apiKey = await this.authService.getOrCreateApiKeyForUser(user);

    if (requiredRole && !this.authService.hasPermission(apiKey, requiredRole)) {
      throw new ForbiddenException(`Insufficient permissions. Required: ${requiredRole}`);
    }

    // Attach user and apiKey to request context
    (request as any).user = user;
    (request as any).apiKey = apiKey;

    return true;
  }

  private extractToken(request: Request): string | undefined {
    const authHeader = request.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    // Fallback for X-API-Key if they are sending the JWT there
    const xApiKey = request.headers['x-api-key'] as string;
    if (xApiKey) return xApiKey;

    return undefined;
  }
}

