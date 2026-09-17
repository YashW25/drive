import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { HeartbeatService } from './heartbeat.service';

@Injectable()
export class HeartbeatMiddleware implements NestMiddleware {
  private readonly route: string;
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly heartbeatService: HeartbeatService,
  ) {
    this.route = this.configService.get<string>('HEARTBEAT_ROUTE') ?? '/api/heartbeat';
    this.enabled = this.configService.get<string>('HEARTBEAT_ENABLED') !== 'false';
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (this.enabled && req.path === this.route && req.method === 'GET') {
      const state = this.heartbeatService.getCachedState();
      if (!state) {
        return res.status(503).json({ status: 'starting' });
      }
      return res.status(200).json({
        ...state,
        timestamp: new Date().toISOString()
      });
    }
    next();
  }
}
