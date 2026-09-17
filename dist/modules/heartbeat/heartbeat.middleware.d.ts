import { NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { HeartbeatService } from './heartbeat.service';
export declare class HeartbeatMiddleware implements NestMiddleware {
    private readonly configService;
    private readonly heartbeatService;
    private readonly route;
    private readonly enabled;
    constructor(configService: ConfigService, heartbeatService: HeartbeatService);
    use(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
}
