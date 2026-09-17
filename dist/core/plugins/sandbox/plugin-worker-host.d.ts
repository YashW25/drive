import { PluginWorkerChannel, PluginLifecycleMethod, SandboxStaticContext, PluginLogLevel } from './protocol';
export declare class PluginWorkerHost {
    private readonly channel;
    private readonly capDispatcher?;
    private readonly onHookSubscribe?;
    private readonly onLog?;
    private nextId;
    private ready;
    private dead;
    private readyWaiters;
    private readonly pending;
    private readonly hookPending;
    private readonly healthPending;
    constructor(channel: PluginWorkerChannel, capDispatcher?: ((verb: string, args: unknown[]) => Promise<unknown>) | undefined, onHookSubscribe?: ((event: string, priority?: number) => void) | undefined, onLog?: ((level: PluginLogLevel, message: string, meta?: Record<string, unknown>) => void) | undefined);
    dispatchHook(options: {
        event: string;
        data: unknown;
        source: string;
        sessionId?: string;
        config?: Record<string, unknown>;
        timeoutMs: number;
        onTimeout?: () => void;
    }): Promise<{
        continue: boolean;
        data?: unknown;
    }>;
    load(mainPath: string, context?: SandboxStaticContext, timeoutMs?: number): Promise<void>;
    runLifecycle(method: PluginLifecycleMethod, timeoutMs?: number): Promise<void>;
    sendConfigChange(config: Record<string, unknown>): void;
    healthCheck(timeoutMs: number): Promise<{
        healthy: boolean;
        message?: string;
    }>;
    terminate(): Promise<void>;
    private handleMessage;
    private handleCapRequest;
    private handleExit;
    private drain;
}
