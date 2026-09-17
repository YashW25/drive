import { DataSource } from 'typeorm';
import { ShutdownService } from '../../common/services/shutdown.service';
import { EngineFactory } from '../../engine/engine.factory';
import { ConfigService } from '@nestjs/config';
interface DependencyStatus {
    status: 'up' | 'down';
}
interface HealthCheckResult {
    status: 'ok' | 'error';
    details: Record<string, DependencyStatus>;
}
export declare class HealthController {
    private readonly mainDataSource;
    private readonly dataDataSource;
    private readonly shutdownService;
    private readonly engineFactory;
    private readonly configService;
    constructor(mainDataSource: DataSource, dataDataSource: DataSource, shutdownService: ShutdownService, engineFactory: EngineFactory, configService: ConfigService);
    check(): {
        status: string;
        engine: string;
        connected: boolean;
        memoryMB: number;
        uptimeSeconds: number;
    };
    heartbeat(): {
        ok: boolean;
    };
    getEnvironmentDebug(): {
        backendVariablesLoaded: {
            SUPABASE_URL: boolean;
            SUPABASE_ANON_KEY: boolean;
            SUPABASE_SERVICE_ROLE_KEY: boolean;
        };
        frontendVariablesExpected: string[];
        currentBuildMode: string;
        nodeVersion: string;
        viteMode: string;
    };
    liveness(): {
        status: string;
    };
    readiness(): Promise<HealthCheckResult>;
    private probeDatabase;
    private withTimeout;
}
export {};
