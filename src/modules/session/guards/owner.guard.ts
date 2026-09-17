import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Request } from 'express';
import { SessionService } from '../session.service';

@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private readonly sessionService: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.params['id'] as string;

    if (!sessionId) {
      return true; // No session ID to check
    }

    const user = (request as any).user;
    if (!user || !user.supabaseId) {
      return true; // Unauthenticated or API key without user
    }

    try {
      const session = await this.sessionService.findOne(sessionId);
      if (session.ownerSupabaseId && session.ownerSupabaseId !== user.supabaseId) {
        throw new ForbiddenException('You do not own this session');
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error; // Let the NotFoundException bubble up
      }
      return false;
    }

    return true;
  }
}
