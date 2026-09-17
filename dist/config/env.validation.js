"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnv = validateEnv;
const path_1 = require("path");
const MAIN_DB_PATH = './data/main.sqlite';
function validateEnv(config) {
    const errors = [];
    const str = (key) => {
        const value = config[key];
        return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
    };
    const dbType = str('DATABASE_TYPE');
    if (dbType && dbType !== 'sqlite' && dbType !== 'postgres') {
        errors.push(`DATABASE_TYPE must be "sqlite" or "postgres" (got "${dbType}")`);
    }
    const checkEnum = (key, allowed) => {
        const value = str(key);
        if (value !== undefined && !allowed.includes(value)) {
            errors.push(`${key} must be one of ${allowed.map(v => `"${v}"`).join(', ')} (got "${value}")`);
        }
    };
    checkEnum('ENGINE_TYPE', ['whatsapp-web.js', 'baileys']);
    checkEnum('STORAGE_TYPE', ['local', 's3']);
    if (dbType === 'postgres') {
        for (const key of ['DATABASE_HOST', 'DATABASE_USERNAME', 'DATABASE_PASSWORD']) {
            if (!str(key)) {
                errors.push(`${key} is required when DATABASE_TYPE=postgres`);
            }
        }
    }
    else {
        const dataDbName = str('DATABASE_NAME');
        if (dataDbName && (0, path_1.resolve)(dataDbName) === (0, path_1.resolve)(MAIN_DB_PATH)) {
            errors.push(`DATABASE_NAME must not point at the main database file (${MAIN_DB_PATH}); use a separate file`);
        }
    }
    const checkPort = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 1 || n > 65535) {
            errors.push(`${key} must be an integer port in [1, 65535] (got "${raw}")`);
        }
    };
    checkPort('PORT');
    checkPort('DATABASE_PORT');
    checkPort('REDIS_PORT');
    const checkNonNegativeInt = (key) => {
        const raw = str(key);
        if (raw === undefined)
            return;
        const n = Number(raw);
        if (!Number.isInteger(n) || n < 0) {
            errors.push(`${key} must be a non-negative integer (got "${raw}")`);
        }
    };
    for (const key of [
        'RATE_LIMIT_SHORT_TTL',
        'RATE_LIMIT_SHORT_LIMIT',
        'RATE_LIMIT_MEDIUM_TTL',
        'RATE_LIMIT_MEDIUM_LIMIT',
        'RATE_LIMIT_LONG_TTL',
        'RATE_LIMIT_LONG_LIMIT',
        'WEBHOOK_TIMEOUT',
        'WEBHOOK_MAX_RETRIES',
        'WEBHOOK_RETRY_DELAY',
        'DATABASE_POOL_SIZE',
    ]) {
        checkNonNegativeInt(key);
    }
    if (errors.length > 0) {
        throw new Error(`Invalid environment configuration:\n  - ${errors.join('\n  - ')}`);
    }
    if (process.env.RENDER === 'true') {
        if (!str('API_MASTER_KEY')) {
            throw new Error(`Missing required environment variable API_MASTER_KEY. On Render, you must provide a fixed API key to avoid it changing on restart.`);
        }
    }
    return config;
}
//# sourceMappingURL=env.validation.js.map