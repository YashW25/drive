"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EngineFactory = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const plugins_1 = require("../core/plugins");
const logger_service_1 = require("../common/services/logger.service");
const baileys_message_store_service_1 = require("./adapters/baileys-message-store.service");
const lid_mapping_store_service_1 = require("./identity/lid-mapping-store.service");
let EngineFactory = class EngineFactory {
    configService;
    pluginLoader;
    baileysMessageStore;
    lidMappingStore;
    logger = (0, logger_service_1.createLogger)('EngineFactory');
    engineType;
    constructor(configService, pluginLoader, baileysMessageStore, lidMappingStore) {
        this.configService = configService;
        this.pluginLoader = pluginLoader;
        this.baileysMessageStore = baileysMessageStore;
        this.lidMappingStore = lidMappingStore;
        this.engineType = (this.configService.get('engine.type') ?? 'whatsapp-web.js').trim().toLowerCase();
    }
    async onModuleInit() {
        await this.registerBuiltInEngines();
    }
    async registerBuiltInEngines() {
        const engineConfig = this.configService.get('engine') ?? {};
        if (this.engineType === 'whatsapp-web.js' || this.engineType === 'browser') {
            const { WhatsAppWebJsPlugin } = await import('../plugins/engines/whatsapp-web-js/index.js');
            const wwjsManifest = {
                id: 'whatsapp-web.js',
                name: 'WhatsApp Web.js Engine',
                version: '1.0.0',
                type: plugins_1.PluginType.ENGINE,
                description: 'Official WhatsApp-web.js engine adapter',
                main: 'index.ts',
                provides: ['whatsapp-engine'],
            };
            const wwjsPlugin = new WhatsAppWebJsPlugin(engineConfig);
            this.pluginLoader.registerBuiltInPlugin(wwjsManifest, wwjsPlugin, engineConfig);
        }
        if (this.engineType === 'baileys') {
            const { BaileysPlugin } = await import('../plugins/engines/baileys/index.js');
            const baileysManifest = {
                id: 'baileys',
                name: 'Baileys Engine',
                version: '1.0.0',
                type: plugins_1.PluginType.ENGINE,
                description: 'Baileys (WebSocket, no-browser) engine adapter',
                main: 'index.ts',
                provides: ['whatsapp-engine'],
            };
            this.pluginLoader.registerBuiltInPlugin(baileysManifest, new BaileysPlugin(this.baileysMessageStore, engineConfig, this.lidMappingStore), engineConfig);
        }
        try {
            await this.pluginLoader.enablePlugin(this.engineType);
            this.logger.log(`Engine plugin enabled: ${this.engineType}`, {
                action: 'engine_enabled',
                engineType: this.engineType,
            });
        }
        catch (error) {
            this.logger.error(`Failed to enable engine plugin: ${this.engineType}`, error instanceof Error ? error.message : String(error), { action: 'engine_enable_failed' });
        }
    }
    create(options) {
        const enginePlugin = this.pluginLoader.getPlugin(this.engineType);
        if (enginePlugin?.instance && this.isEnginePlugin(enginePlugin.instance)) {
            return enginePlugin.instance.createEngine({
                sessionId: options.sessionId,
                proxyUrl: options.proxyUrl,
                proxyType: options.proxyType,
            });
        }
        this.logger.warn(`Engine plugin ${this.engineType} not available, using fallback`, {
            action: 'engine_fallback',
        });
        return this.createFallbackEngine(options);
    }
    isEnginePlugin(instance) {
        return (typeof instance === 'object' &&
            instance !== null &&
            'type' in instance &&
            instance.type === plugins_1.PluginType.ENGINE &&
            'createEngine' in instance &&
            typeof instance.createEngine === 'function');
    }
    createFallbackEngine(options) {
        throw new Error(`Engine plugin ${this.engineType} not available, and synchronous fallback is disabled.`);
    }
    getAvailableEngines() {
        const enginePlugins = this.pluginLoader.getPluginsByType(plugins_1.PluginType.ENGINE);
        return enginePlugins.map(plugin => {
            const inst = plugin.instance;
            const features = inst && this.isEnginePlugin(inst) ? inst.getFeatures() : [];
            const library = inst && this.isEnginePlugin(inst) ? inst.getEngineLibrary?.() : undefined;
            return {
                id: plugin.manifest.id,
                name: plugin.manifest.name,
                enabled: this.pluginLoader.isPluginEnabled(plugin.manifest.id),
                features,
                library,
            };
        });
    }
    getCurrentEngine() {
        return this.engineType;
    }
};
exports.EngineFactory = EngineFactory;
exports.EngineFactory = EngineFactory = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        plugins_1.PluginLoaderService,
        baileys_message_store_service_1.BaileysMessageStoreService,
        lid_mapping_store_service_1.LidMappingStoreService])
], EngineFactory);
//# sourceMappingURL=engine.factory.js.map