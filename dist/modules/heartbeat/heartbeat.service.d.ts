import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EngineFactory } from '../../engine/engine.factory';
import { Repository } from 'typeorm';
import { Session } from '../session/entities/session.entity';
export declare class HeartbeatService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly engineFactory;
    private readonly sessionRepository;
    private readonly logger;
    private timer?;
    private cachedState;
    private isEnabled;
    private loggingEnabled;
    private showMemory;
    private showUptime;
    private showVersion;
    private startTime;
    constructor(configService: ConfigService, engineFactory: EngineFactory, sessionRepository: Repository<Session>);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    private updateCache;
    getCachedState(): any;
}
