import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IWhatsAppEngine } from './interfaces/whatsapp-engine.interface';
import { PluginLoaderService, PluginType, IEnginePlugin, PluginManifest } from '../core/plugins';
import { createLogger } from '../common/services/logger.service';
import { BaileysMessageStoreService } from './adapters/baileys-message-store.service';
import { LidMappingStoreService } from './identity/lid-mapping-store.service';

export interface EngineCreateOptions {
  sessionId: string;
  proxyUrl?: string;
  proxyType?: 'http' | 'https' | 'socks4' | 'socks5';
}

@Injectable()
export class EngineFactory implements OnModuleInit {
  private readonly logger = createLogger('EngineFactory');
  private readonly engineType: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly pluginLoader: PluginLoaderService,
    private readonly baileysMessageStore: BaileysMessageStoreService,
    private readonly lidMappingStore: LidMappingStoreService,
  ) {
    this.engineType = (this.configService.get<string>('engine.type') ?? 'whatsapp-web.js').trim().toLowerCase();
  }

  async onModuleInit(): Promise<void> {
    // Register built-in engine plugins
    await this.registerBuiltInEngines();
  }

  private async registerBuiltInEngines(): Promise<void> {
    // The engine config sub-tree (engine.* from configuration.ts) as an opaque blob. Supplied BOTH
    // to registerBuiltInPlugin (becomes context.config when onLoad runs) AND to each plugin's
    // constructor (A fallback so createEngine still has operator config if enablePlugin fails
    // before onLoad — otherwise sessionDataPath/executablePath/authDir would silently drop to defaults).
    const engineConfig = this.configService.get<Record<string, unknown>>('engine') ?? {};

    // Register WhatsApp-web.js as built-in plugin if configured
    if (this.engineType === 'whatsapp-web.js' || this.engineType === 'browser') {
      const { WhatsAppWebJsPlugin } = await import('../plugins/engines/whatsapp-web-js/index.js');
      const wwjsManifest: PluginManifest = {
        id: 'whatsapp-web.js',
        name: 'WhatsApp Web.js Engine',
        version: '1.0.0',
        type: PluginType.ENGINE,
        description: 'Official WhatsApp-web.js engine adapter',
        main: 'index.ts',
        provides: ['whatsapp-engine'],
      };

      const wwjsPlugin = new WhatsAppWebJsPlugin(engineConfig);
      this.pluginLoader.registerBuiltInPlugin(wwjsManifest, wwjsPlugin, engineConfig);
    }

    // Register Baileys as built-in plugin if configured
    if (this.engineType === 'baileys') {
      const { BaileysPlugin } = await import('../plugins/engines/baileys/index.js');
      const baileysManifest: PluginManifest = {
        id: 'baileys',
        name: 'Baileys Engine',
        version: '1.0.0',
        type: PluginType.ENGINE,
        description: 'Baileys (WebSocket, no-browser) engine adapter',
        main: 'index.ts',
        provides: ['whatsapp-engine'],
      };
      this.pluginLoader.registerBuiltInPlugin(
        baileysManifest,
        new BaileysPlugin(this.baileysMessageStore, engineConfig, this.lidMappingStore),
        engineConfig,
      );
    }

    // Auto-enable the configured engine
    try {
      await this.pluginLoader.enablePlugin(this.engineType);
      this.logger.log(`Engine plugin enabled: ${this.engineType}`, {
        action: 'engine_enabled',
        engineType: this.engineType,
      });
    } catch (error) {
      this.logger.error(
        `Failed to enable engine plugin: ${this.engineType}`,
        error instanceof Error ? error.message : String(error),
        { action: 'engine_enable_failed' },
      );
    }
  }

  create(options: EngineCreateOptions): IWhatsAppEngine {
    // Try to get engine from plugin system
    const enginePlugin = this.pluginLoader.getPlugin(this.engineType);

    if (enginePlugin?.instance && this.isEnginePlugin(enginePlugin.instance)) {
      // Engine-neutral per-call config only. Engine-specific config (e.g. Puppeteer for
      // whatsapp-web.js) is supplied to the plugin as an opaque blob via context.config at
      // registration, so the factory never assembles browser-shaped fields.
      return enginePlugin.instance.createEngine({
        sessionId: options.sessionId,
        proxyUrl: options.proxyUrl,
        proxyType: options.proxyType,
      }) as IWhatsAppEngine;
    }

    // Fallback to direct adapter creation (legacy support)
    this.logger.warn(`Engine plugin ${this.engineType} not available, using fallback`, {
      action: 'engine_fallback',
    });

    return this.createFallbackEngine(options);
  }

  private isEnginePlugin(instance: unknown): instance is IEnginePlugin {
    return (
      typeof instance === 'object' &&
      instance !== null &&
      'type' in instance &&
      instance.type === PluginType.ENGINE &&
      'createEngine' in instance &&
      typeof (instance as { createEngine: unknown }).createEngine === 'function'
    );
  }

  private createFallbackEngine(options: EngineCreateOptions): IWhatsAppEngine {
    // Synchronous fallback is disabled to prevent accidental loading of heavy modules (Puppeteer).
    // The engine must be successfully registered as a plugin during onModuleInit.
    throw new Error(`Engine plugin ${this.engineType} not available, and synchronous fallback is disabled.`);
  }

  // ============================================================================
  // Query Methods for API/Dashboard
  // ============================================================================

  getAvailableEngines(): Array<{
    id: string;
    name: string;
    enabled: boolean;
    features: string[];
    library?: { name: string; version: string };
  }> {
    const enginePlugins = this.pluginLoader.getPluginsByType(PluginType.ENGINE);

    return enginePlugins.map(plugin => {
      const inst = plugin.instance;
      const features = inst && this.isEnginePlugin(inst) ? inst.getFeatures() : [];
      // The real underlying library version (e.g. whatsapp-web.js 1.34.7), distinct from the
      // plugin's manifest version — so the dashboard can show which engine is actually running.
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

  getCurrentEngine(): string {
    return this.engineType;
  }
}
