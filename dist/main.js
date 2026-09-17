"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const swagger_1 = require("@nestjs/swagger");
const helmet_1 = __importDefault(require("helmet"));
const app_module_1 = require("./app.module");
const shutdown_service_1 = require("./common/services/shutdown.service");
const logger_service_1 = require("./common/services/logger.service");
const swagger_config_1 = require("./config/swagger.config");
const bootstrap_security_1 = require("./config/bootstrap-security");
const bull_board_auth_middleware_1 = require("./common/security/bull-board-auth.middleware");
const auth_service_1 = require("./modules/auth/auth.service");
const express_1 = require("express");
const secret_file_1 = require("./common/utils/secret-file");
const env_precedence_1 = require("./config/env-precedence");
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const generatedEnvPath = path.resolve(process.cwd(), 'data', '.env.generated');
const userEnvPath = path.resolve(process.cwd(), '.env');
const dataDir = path.dirname(generatedEnvPath);
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}
for (const secret of [generatedEnvPath, path.resolve(dataDir, '.api-key')]) {
    if (fs.existsSync(secret)) {
        try {
            fs.chmodSync(secret, 0o600);
        }
        catch {
        }
    }
}
(0, env_precedence_1.clearBlankEnv)(process.env, env_precedence_1.BLANK_SHADOWED_ENV_KEYS);
if (fs.existsSync(userEnvPath)) {
    console.log('[Bootstrap] Loading .env from:', userEnvPath);
    dotenv.config({ path: userEnvPath, override: false });
}
if (fs.existsSync(generatedEnvPath)) {
    console.log('[Bootstrap] Loading saved configuration from:', generatedEnvPath);
    dotenv.config({ path: generatedEnvPath, override: false });
}
else {
    console.log('[Bootstrap] First run detected, creating default configuration...');
    const minimalConfig = `# OpenWA Configuration
# Generated automatically on first run
# Edit via Dashboard > Infrastructure or modify this file directly.
# Note: values in process env or project .env take precedence over this file.

# Database (SQLite - no external service required)
DATABASE_TYPE=sqlite
POSTGRES_BUILTIN=false

# Redis & Queue (disabled by default)
REDIS_ENABLED=false
REDIS_BUILTIN=false
QUEUE_ENABLED=false

# Storage (Local filesystem)
STORAGE_TYPE=local
MINIO_BUILTIN=false
STORAGE_LOCAL_PATH=./data/media

# Docker Profiles: none (minimal setup)
`;
    (0, secret_file_1.writeSecretFile)(generatedEnvPath, minimalConfig);
    console.log('[Bootstrap] Created default configuration at:', generatedEnvPath);
    dotenv.config({ path: generatedEnvPath, override: false });
}
async function bootstrap() {
    const requestedLevel = process.env.LOG_LEVEL?.trim().toLowerCase();
    if (requestedLevel && Object.values(logger_service_1.LogLevel).includes(requestedLevel)) {
        logger_service_1.LoggerService.setLogLevel(requestedLevel);
    }
    const bootstrapLogger = (0, logger_service_1.createLogger)('Bootstrap');
    process.on('unhandledRejection', (reason) => {
        bootstrapLogger.error('Unhandled promise rejection', reason instanceof Error ? reason.stack : String(reason));
    });
    (0, bootstrap_security_1.assertNoDefaultSecretsInProduction)({
        nodeEnv: process.env.NODE_ENV,
        databaseType: process.env.DATABASE_TYPE,
        databasePassword: process.env.DATABASE_PASSWORD,
        storageType: process.env.STORAGE_TYPE,
        s3AccessKey: process.env.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY,
        s3SecretKey: process.env.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_KEY,
        apiMasterKey: process.env.API_MASTER_KEY,
        allowDevApiKey: process.env.ALLOW_DEV_API_KEY,
        redisPassword: process.env.REDIS_PASSWORD,
    });
    if ((0, bootstrap_security_1.isApiKeyPepperMissingInProduction)(process.env.NODE_ENV, process.env.API_KEY_PEPPER)) {
        bootstrapLogger.warn('API_KEY_PEPPER is not set in production: stored API-key hashes use plain SHA-256. ' +
            'Set API_KEY_PEPPER and re-issue keys to enable HMAC hashing.');
    }
    const app = await core_1.NestFactory.create(app_module_1.AppModule, { bodyParser: false });
    const bodyLimit = (0, bootstrap_security_1.resolveBodyLimit)(process.env.BODY_SIZE_LIMIT);
    app.use((0, express_1.json)({ limit: bodyLimit }));
    app.use((0, express_1.urlencoded)({ extended: true, limit: bodyLimit }));
    app.enableShutdownHooks();
    const shutdownService = app.get(shutdown_service_1.ShutdownService);
    shutdownService.setShutdownCallback(async () => {
        await app.close();
    });
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => shutdownService.markShuttingDown());
    }
    app.use((0, helmet_1.default)({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
                mediaSrc: ["'self'", 'data:', 'blob:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", 'https://fonts.gstatic.com'],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
            },
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
        },
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    }));
    const corsPolicy = (0, bootstrap_security_1.resolveCorsPolicy)(process.env.CORS_ORIGINS, process.env.NODE_ENV);
    if (process.env.NODE_ENV === 'production' && corsPolicy.origins.length === 0 && !corsPolicy.allowAnyOrigin) {
        console.warn('[Bootstrap] No explicit CORS_ORIGINS in production (wildcard "*" is refused): cross-origin browser ' +
            'requests will be blocked. Set CORS_ORIGINS to your dashboard origin(s).');
    }
    app.enableCors({
        origin: (origin, callback) => {
            if (!origin)
                return callback(null, true);
            if (corsPolicy.allowAnyOrigin || corsPolicy.origins.includes(origin)) {
                callback(null, true);
            }
            else {
                callback(null, false);
            }
        },
        credentials: corsPolicy.credentials,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization', 'X-Request-ID'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
        maxAge: 86400,
    });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: {
            enableImplicitConversion: true,
        },
        disableErrorMessages: process.env.NODE_ENV === 'production',
    }));
    const swaggerEnabled = (0, bootstrap_security_1.isSwaggerEnabled)(process.env.ENABLE_SWAGGER, process.env.NODE_ENV);
    if (swaggerEnabled) {
        const config = (0, swagger_config_1.createSwaggerConfig)();
        const document = swagger_1.SwaggerModule.createDocument(app, config);
        swagger_1.SwaggerModule.setup('api/docs', app, document);
    }
    const bullBoardAuth = new bull_board_auth_middleware_1.BullBoardAuthMiddleware(app.get(auth_service_1.AuthService), app.get(config_1.ConfigService));
    app.use('/api/admin/queues', (req, res, next) => {
        void bullBoardAuth.use(req, res, next);
    });
    const port = process.env.PORT || 2785;
    await app.listen(port);
    console.log(`🚀 OpenWA is running on: http://localhost:${port}`);
    if (swaggerEnabled) {
        console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
    }
    if (!app_module_1.dashboardServingEnabled) {
        console.log('🖥️  Dashboard: serving disabled (SERVE_DASHBOARD=false); API only');
    }
    else if (app_module_1.dashboardBuildPresent) {
        console.log(`🖥️  Dashboard: serving bundled UI at http://localhost:${port}`);
    }
    else {
        console.warn(`⚠️  Dashboard: no build at ${app_module_1.DASHBOARD_DIST} - UI disabled (API still serves /api). ` +
            'Run `npm run build:all` to bundle it, or use the Vite dev server (`npm run dev`).');
    }
}
void bootstrap();
//# sourceMappingURL=main.js.map