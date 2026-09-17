import { PluginContext, PluginType, IEnginePlugin } from '../../../core/plugins';
import { IWhatsAppEngine } from '../../../engine/interfaces/whatsapp-engine.interface';
export declare class WhatsAppWebJsPlugin implements IEnginePlugin {
    private readonly registeredConfig?;
    type: PluginType.ENGINE;
    private context?;
    constructor(registeredConfig?: Record<string, unknown> | undefined);
    onLoad(context: PluginContext): Promise<void>;
    onEnable(context: PluginContext): Promise<void>;
    onDisable(context: PluginContext): Promise<void>;
    createEngine(config: Record<string, unknown>): IWhatsAppEngine;
    getFeatures(): string[];
    getEngineLibrary(): {
        name: string;
        version: string;
    };
    healthCheck(): Promise<{
        healthy: boolean;
        message?: string;
    }>;
}
export default WhatsAppWebJsPlugin;
