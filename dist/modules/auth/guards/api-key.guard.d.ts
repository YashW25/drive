import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';
export declare class ApiKeyGuard implements CanActivate {
    private readonly authService;
    private readonly reflector;
    private readonly configService;
    constructor(authService: AuthService, reflector: Reflector, configService: ConfigService);
    canActivate(context: ExecutionContext): Promise<boolean>;
    private extractToken;
}
