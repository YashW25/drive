export declare class ShutdownService {
    private readonly logger;
    private destroyCallback;
    private shuttingDown;
    setShutdownCallback(callback: () => Promise<void>): void;
    isShuttingDown(): boolean;
    markShuttingDown(): void;
    shutdown(delayMs?: number): void;
    private resolveDelay;
}
