import { HookManager, HookEvent, HookHandler } from '../hooks';
import type { MessageResponseDto } from '../../modules/message/dto';
import type { IWhatsAppEngine } from '../../engine/interfaces/whatsapp-engine.interface';
import type { PluginNetRequestInit, PluginNetResponse } from './plugin-net';
export declare enum PluginType {
    ENGINE = "engine",
    STORAGE = "storage",
    QUEUE = "queue",
    AUTH = "auth",
    EXTENSION = "extension"
}
export declare enum PluginStatus {
    INSTALLED = "installed",
    ENABLED = "enabled",
    DISABLED = "disabled",
    ERROR = "error"
}
export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    type: PluginType;
    description?: string;
    author?: string;
    homepage?: string;
    repository?: string;
    license?: string;
    main: string;
    dependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    configSchema?: PluginConfigSchema;
    configUi?: {
        entry: string;
        height?: number;
    };
    hooks?: HookEvent[];
    provides?: string[];
    requires?: string[];
    permissions?: string[];
    sessions?: string[];
    sessionScoped?: boolean;
    net?: {
        allow?: string[];
    };
    i18n?: PluginI18n;
}
export interface PluginI18nText {
    title?: string;
    description?: string;
}
export interface PluginI18nLocale {
    name?: string;
    description?: string;
    config?: Record<string, PluginI18nText>;
}
export type PluginI18n = Record<string, PluginI18nLocale>;
export interface PluginConfigField {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'textarea';
    title?: string;
    description?: string;
    default?: unknown;
    enum?: unknown[];
    required?: boolean;
    secret?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
    items?: PluginConfigField;
    properties?: Record<string, PluginConfigField>;
}
export interface PluginConfigSchema {
    type: 'object';
    properties: Record<string, PluginConfigField>;
}
export declare const PluginCapabilityPermission: {
    readonly MESSAGES_SEND: "messages:send";
    readonly ENGINE_READ: "engine:read";
    readonly NET_FETCH: "net:fetch";
};
export type PluginCapabilityPermission = (typeof PluginCapabilityPermission)[keyof typeof PluginCapabilityPermission];
export declare class PluginCapabilityError extends Error {
    constructor(message: string);
}
export interface PluginMessagingCapability {
    sendText(sessionId: string, chatId: string, text: string): Promise<MessageResponseDto>;
    reply(sessionId: string, chatId: string, quotedMessageId: string, text: string): Promise<MessageResponseDto>;
}
export interface PluginEngineReadCapability {
    getGroupInfo(sessionId: string, groupId: string): ReturnType<IWhatsAppEngine['getGroupInfo']>;
    getContacts(sessionId: string): ReturnType<IWhatsAppEngine['getContacts']>;
    getContactById(sessionId: string, contactId: string): ReturnType<IWhatsAppEngine['getContactById']>;
    checkNumberExists(sessionId: string, phone: string): ReturnType<IWhatsAppEngine['checkNumberExists']>;
    getChats(sessionId: string): ReturnType<IWhatsAppEngine['getChats']>;
}
export interface PluginNetCapability {
    fetch(url: string, init?: PluginNetRequestInit): Promise<PluginNetResponse>;
}
export interface PluginContext {
    pluginId: string;
    manifest: PluginManifest;
    config: Record<string, unknown>;
    hookManager: HookManager;
    logger: PluginLogger;
    storage: PluginStorage;
    registerHook: (event: HookEvent, handler: HookHandler, priority?: number) => void;
    messages: PluginMessagingCapability;
    engine: PluginEngineReadCapability;
    net: PluginNetCapability;
}
export interface PluginLogger {
    log: (message: string, meta?: Record<string, unknown>) => void;
    debug: (message: string, meta?: Record<string, unknown>) => void;
    warn: (message: string, meta?: Record<string, unknown>) => void;
    error: (message: string, error?: unknown, meta?: Record<string, unknown>) => void;
}
export interface PluginStorage {
    get: <T = unknown>(key: string) => Promise<T | null>;
    set: <T = unknown>(key: string, value: T) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: (prefix?: string) => Promise<string[]>;
}
export interface IPlugin {
    onLoad?: (context: PluginContext) => Promise<void>;
    onEnable?: (context: PluginContext) => Promise<void>;
    onDisable?: (context: PluginContext) => Promise<void>;
    onUnload?: (context: PluginContext) => Promise<void>;
    onConfigChange?: (context: PluginContext, newConfig: Record<string, unknown>) => Promise<void>;
    healthCheck?: () => Promise<{
        healthy: boolean;
        message?: string;
    }>;
}
export interface IEnginePlugin extends IPlugin {
    type: PluginType.ENGINE;
    createEngine: (config: Record<string, unknown>) => unknown;
    getFeatures: () => string[];
    getEngineLibrary?: () => {
        name: string;
        version: string;
    };
}
export interface PluginInstance {
    manifest: PluginManifest;
    status: PluginStatus;
    config: Record<string, unknown>;
    instance: IPlugin | null;
    error?: string;
    loadedAt?: Date;
    enabledAt?: Date;
    activeSessions?: string[];
    sessionConfig?: Record<string, Record<string, unknown>>;
    builtIn?: boolean;
}
export interface PluginRegistryEntry {
    id: string;
    type: PluginType;
    name: string;
    version: string;
    status: PluginStatus;
    config: Record<string, unknown>;
    builtIn: boolean;
    installedAt: Date;
    updatedAt: Date;
    activeSessions?: string[];
    sessionConfig?: Record<string, Record<string, unknown>>;
}
