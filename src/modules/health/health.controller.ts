import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Public } from '../auth/decorators/auth.decorators';
import { SkipThrottle } from '@nestjs/throttler';
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

/** Bound each dependency probe so a hung connection can't stall the readiness check. */
const READINESS_PROBE_TIMEOUT_MS = 3000;

// Source the running version from package.json (same pattern as swagger.config.ts) so the dashboard
// can read it live and never show a stale build-time-baked version. Read once at module load.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { version: APP_VERSION } = require('../../../package.json') as { version: string };

@ApiTags('health')
@Controller('health')
@Public()
@SkipThrottle()
export class HealthController {
  constructor(
    @InjectDataSource('main') private readonly mainDataSource: DataSource,
    @InjectDataSource('data') private readonly dataDataSource: DataSource,
    private readonly shutdownService: ShutdownService,
    private readonly engineFactory: EngineFactory,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Application is healthy' })
  check() {
    const memory = process.memoryUsage();
    return {
      status: 'healthy',
      engine: this.engineFactory.getCurrentEngine(),
      connected: this.mainDataSource.isInitialized && this.dataDataSource.isInitialized,
      memoryMB: Math.round(memory.rss / 1024 / 1024),
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }

  @Get('heartbeat')
  @ApiOperation({ summary: 'Lightweight keep-alive heartbeat' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  heartbeat(): { ok: boolean } {
    return { ok: true };
  }

  @Get('debug/environment')
  @ApiOperation({ summary: 'Debug environment variables (development only)' })
  getEnvironmentDebug() {
    // We only indicate existence to avoid leaking secrets
    return {
      backendVariablesLoaded: {
        SUPABASE_URL: !!process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: !!process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
      frontendVariablesExpected: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
      currentBuildMode: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      viteMode: process.env.VITE_USER_NODE_ENV || 'production'
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe for Kubernetes' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  liveness(): { status: string } {
    // Liveness only reflects process liveness — deliberately static so a transient
    // dependency outage doesn't trigger a pod KILL (that's readiness' job).
    return { status: 'ok' };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — verifies the auth/audit + data databases respond' })
  @ApiResponse({ status: 200, description: 'Application is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'A required dependency is down' })
  async readiness(): Promise<HealthCheckResult> {
    // While draining (shutdown started), report 503 so the LB/orchestrator stops
    // routing new traffic before teardown — even if the DBs are still up.
    if (this.shutdownService.isShuttingDown()) {
      throw new ServiceUnavailableException({ status: 'error', details: { shutdown: { status: 'draining' } } });
    }

    const [main, data] = await Promise.all([
      this.probeDatabase(this.mainDataSource),
      this.probeDatabase(this.dataDataSource),
    ]);

    const details: Record<string, DependencyStatus> = {
      mainDatabase: { status: main },
      dataDatabase: { status: data },
    };

    if (main === 'down' || data === 'down') {
      // 503 so orchestrators/LBs stop routing traffic to a node with a dead DB.
      throw new ServiceUnavailableException({ status: 'error', details });
    }

    return { status: 'ok', details };
  }

  private async probeDatabase(dataSource: DataSource): Promise<'up' | 'down'> {
    try {
      await this.withTimeout(dataSource.query('SELECT 1'), READINESS_PROBE_TIMEOUT_MS);
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('readiness probe timed out')), ms);
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}
