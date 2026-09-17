import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EngineFactory } from '../../engine/engine.factory';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Session, SessionStatus } from '../session/entities/session.entity';
const { version: APP_VERSION } = require('../../../package.json') as { version: string };

@Injectable()
export class HeartbeatService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);
  private timer?: NodeJS.Timeout;
  private cachedState: any = null;
  private isEnabled: boolean;
  private loggingEnabled: boolean;
  private showMemory: boolean;
  private showUptime: boolean;
  private showVersion: boolean;
  private startTime: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly engineFactory: EngineFactory,
    @InjectRepository(Session, 'data')
    private readonly sessionRepository: Repository<Session>,
  ) {
    this.isEnabled = this.configService.get<string>('HEARTBEAT_ENABLED') !== 'false'; // default true
    this.loggingEnabled = this.configService.get<string>('HEARTBEAT_LOGGING') === 'true'; // default false
    this.showMemory = this.configService.get<string>('HEARTBEAT_SHOW_MEMORY') !== 'false';
    this.showUptime = this.configService.get<string>('HEARTBEAT_SHOW_UPTIME') !== 'false';
    this.showVersion = this.configService.get<string>('HEARTBEAT_SHOW_VERSION') !== 'false';
    this.startTime = Date.now();
  }

  async onModuleInit() {
    if (this.isEnabled) {
      await this.updateCache();
      this.timer = setInterval(() => {
        this.updateCache().catch(err => this.logger.error('Heartbeat cache update failed', err));
      }, 30000);
      this.timer.unref(); // Ensure it doesn't block Node exit
    }
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async updateCache() {
    // Determine active session state
    let sessionName = 'default';
    let isConnected = false;

    try {
      // Find the most recently active session, or 'default' if none exist
      const activeSession = await this.sessionRepository.findOne({
        order: { lastActiveAt: 'DESC' },
      });
      if (activeSession) {
        sessionName = activeSession.name;
        isConnected = activeSession.status === SessionStatus.READY;
      }
    } catch (e) {
      // Ignore DB errors during cache update to prevent crashing
    }

    const memory = process.memoryUsage();
    
    this.cachedState = {
      status: isConnected ? 'alive' : 'degraded',
      service: 'OpenWA Lite',
      engine: this.engineFactory.getCurrentEngine(),
      connected: isConnected,
      session: sessionName,
      ...(this.showUptime && { uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000) }),
      ...(this.showMemory && { memoryMB: Math.round(memory.rss / 1024 / 1024) }),
      ...(this.showVersion && { version: APP_VERSION }),
    };

    // The endpoint itself should return the timestamp of the request, but we can also store the cache time
    // We will inject the timestamp in the middleware.

    if (this.loggingEnabled) {
      this.logger.log(`[Heartbeat] Status: ${this.cachedState.status} | Memory: ${this.cachedState.memoryMB}MB | Connection: ${this.cachedState.connected}`);
    }
  }

  getCachedState() {
    return this.cachedState;
  }
}
