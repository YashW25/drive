"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveCorsPolicy = resolveCorsPolicy;
exports.isSwaggerEnabled = isSwaggerEnabled;
exports.resolveBodyLimit = resolveBodyLimit;
exports.isApiKeyPepperMissingInProduction = isApiKeyPepperMissingInProduction;
exports.assertNoDefaultSecretsInProduction = assertNoDefaultSecretsInProduction;
function resolveCorsPolicy(corsOriginsEnv, nodeEnv) {
    const origins = corsOriginsEnv
        ?.split(',')
        .map(o => o.trim())
        .filter(Boolean) ?? ['*'];
    const hasWildcard = origins.includes('*');
    if (hasWildcard && nodeEnv === 'production') {
        return { origins: [], allowAnyOrigin: false, credentials: false };
    }
    return {
        origins,
        allowAnyOrigin: hasWildcard,
        credentials: !hasWildcard,
    };
}
function isSwaggerEnabled(enableSwaggerEnv, nodeEnv) {
    if (enableSwaggerEnv === 'true')
        return true;
    if (enableSwaggerEnv === 'false')
        return false;
    return nodeEnv !== 'production';
}
function resolveBodyLimit(bodySizeEnv) {
    const trimmed = bodySizeEnv?.trim();
    return trimmed ? trimmed : '25mb';
}
const FORBIDDEN_PROD_SECRETS = new Set([
    'openwa',
    'minioadmin',
    'your-secure-password',
    'dev-master-key',
    'dev-admin-key',
    'changeme',
    'change-me',
    'password',
    'secret',
    'admin',
    '123456',
    'qwerty',
    'root',
    'test',
    'demo',
]);
function isApiKeyPepperMissingInProduction(nodeEnv, apiKeyPepper) {
    return nodeEnv === 'production' && !apiKeyPepper?.trim();
}
function assertNoDefaultSecretsInProduction(env) {
    if (env.nodeEnv !== 'production')
        return;
    const isWeak = (value) => !value || FORBIDDEN_PROD_SECRETS.has(value.trim().toLowerCase());
    const problems = [];
    if (env.databaseType === 'postgres' && isWeak(env.databasePassword)) {
        problems.push('DATABASE_PASSWORD');
    }
    if (env.storageType === 's3') {
        if (isWeak(env.s3AccessKey))
            problems.push('S3_ACCESS_KEY');
        if (isWeak(env.s3SecretKey))
            problems.push('S3_SECRET_KEY');
    }
    if (env.apiMasterKey && FORBIDDEN_PROD_SECRETS.has(env.apiMasterKey.trim().toLowerCase())) {
        problems.push('API_MASTER_KEY');
    }
    if (env.redisPassword && FORBIDDEN_PROD_SECRETS.has(env.redisPassword.trim().toLowerCase())) {
        problems.push('REDIS_PASSWORD');
    }
    if (env.allowDevApiKey === 'true') {
        problems.push('ALLOW_DEV_API_KEY (seeds the public dev-admin-key)');
    }
    if (problems.length > 0) {
        throw new Error(`Refusing to start in production: insecure or default value for ${problems.join(', ')}. ` +
            'Set strong, unique secrets (see .env.example).');
    }
}
//# sourceMappingURL=bootstrap-security.js.map