"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.API_KEY_SECURITY_SCHEME = void 0;
exports.createSwaggerConfig = createSwaggerConfig;
const swagger_1 = require("@nestjs/swagger");
exports.API_KEY_SECURITY_SCHEME = 'X-API-Key';
function createSwaggerConfig() {
    const { version } = require('../../package.json');
    return (new swagger_1.DocumentBuilder()
        .setTitle('OpenWA API')
        .setDescription('Open Source WhatsApp API Gateway - Free, Self-Hosted HTTP API')
        .setVersion(version)
        .addApiKey({ type: 'apiKey', name: 'X-API-Key', in: 'header' }, exports.API_KEY_SECURITY_SCHEME)
        .addSecurityRequirements(exports.API_KEY_SECURITY_SCHEME)
        .addTag('sessions', 'WhatsApp session management')
        .addTag('messages', 'Send and manage messages')
        .addTag('webhooks', 'Webhook configuration')
        .addTag('contacts', 'Contact management')
        .addTag('groups', 'Group management')
        .addTag('labels', 'Label management (WhatsApp Business)')
        .addTag('channels', 'Channel/Newsletter management')
        .addTag('health', 'Health check endpoints')
        .build());
}
//# sourceMappingURL=swagger.config.js.map