import { ConfigService } from '@nestjs/config';
import { PluginLoaderService } from '../../core/plugins';
import { PluginDto } from './dto/plugin.dto';
import { CatalogPlugin } from './catalog';
export declare class PluginsService {
    private readonly pluginLoader;
    private readonly configService;
    constructor(pluginLoader: PluginLoaderService, configService: ConfigService);
    findAll(): PluginDto[];
    findOne(id: string): PluginDto;
    enable(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    disable(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    updateSessions(id: string, sessions: string[], allowedSessions?: string[] | null): PluginDto;
    updateConfig(id: string, config: Record<string, unknown>): {
        success: boolean;
        message: string;
    };
    updateSessionConfig(id: string, sessionId: string, config: Record<string, unknown>): {
        success: boolean;
        message: string;
    };
    private redactSessionConfig;
    getConfigUiHtml(id: string): string;
    install(file?: {
        buffer?: Buffer;
    }): PluginDto;
    installFromUrl(url: string): Promise<PluginDto>;
    getCatalog(): Promise<CatalogPlugin[]>;
    updatePackage(id: string, buffer: Buffer): Promise<PluginDto>;
    updateFromUrl(id: string, url: string): Promise<PluginDto>;
    uninstall(id: string): Promise<{
        success: boolean;
        message: string;
    }>;
    healthCheck(id: string): Promise<{
        healthy: boolean;
        message?: string;
    }>;
}
