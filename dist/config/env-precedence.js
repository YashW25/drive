"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BLANK_SHADOWED_ENV_KEYS = void 0;
exports.clearBlankEnv = clearBlankEnv;
exports.BLANK_SHADOWED_ENV_KEYS = ['ENGINE_TYPE', 'DATABASE_PASSWORD'];
function clearBlankEnv(env, keys) {
    for (const key of keys) {
        const value = env[key];
        if (value !== undefined && value.trim() === '') {
            delete env[key];
        }
    }
}
//# sourceMappingURL=env-precedence.js.map