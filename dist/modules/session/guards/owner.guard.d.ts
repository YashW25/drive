import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SessionService } from '../session.service';
export declare class OwnerGuard implements CanActivate {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
