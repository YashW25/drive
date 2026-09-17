"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginWorkerHost = void 0;
class PluginWorkerHost {
    channel;
    capDispatcher;
    onHookSubscribe;
    onLog;
    nextId = 1;
    ready = false;
    dead = false;
    readyWaiters = [];
    pending = new Map();
    hookPending = new Map();
    healthPending = new Map();
    constructor(channel, capDispatcher, onHookSubscribe, onLog) {
        this.channel = channel;
        this.capDispatcher = capDispatcher;
        this.onHookSubscribe = onHookSubscribe;
        this.onLog = onLog;
        this.channel.onMessage(message => this.handleMessage(message));
        this.channel.onExit(code => this.handleExit(code));
    }
    dispatchHook(options) {
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.hookPending.delete(id);
                options.onTimeout?.();
                resolve({ continue: true });
            }, options.timeoutMs);
            this.hookPending.set(id, { resolve, timer });
            this.channel.postMessage({
                kind: 'hook',
                id,
                event: options.event,
                data: options.data,
                sessionId: options.sessionId,
                source: options.source,
                config: options.config,
            });
        });
    }
    load(mainPath, context, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (this.dead)
                return reject(new Error('plugin worker is no longer running'));
            if (this.ready)
                return resolve();
            const waiter = {
                resolve,
                reject,
            };
            if (timeoutMs !== undefined) {
                waiter.timer = setTimeout(() => {
                    const index = this.readyWaiters.indexOf(waiter);
                    if (index !== -1)
                        this.readyWaiters.splice(index, 1);
                    reject(new Error(`plugin worker load timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }
            this.readyWaiters.push(waiter);
            this.channel.postMessage(context ? { kind: 'load', mainPath, context } : { kind: 'load', mainPath });
        });
    }
    runLifecycle(method, timeoutMs) {
        return new Promise((resolve, reject) => {
            if (this.dead)
                return reject(new Error('plugin worker is no longer running'));
            const id = this.nextId++;
            const entry = {
                resolve,
                reject,
            };
            if (timeoutMs !== undefined) {
                entry.timer = setTimeout(() => {
                    this.pending.delete(id);
                    reject(new Error(`plugin worker lifecycle '${method}' timed out after ${timeoutMs}ms`));
                }, timeoutMs);
            }
            this.pending.set(id, entry);
            this.channel.postMessage({ kind: 'lifecycle', id, method });
        });
    }
    sendConfigChange(config) {
        if (this.dead)
            return;
        this.channel.postMessage({ kind: 'config-change', config });
    }
    healthCheck(timeoutMs) {
        if (this.dead)
            return Promise.resolve({ healthy: false, message: 'plugin worker is no longer running' });
        const id = this.nextId++;
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.healthPending.delete(id);
                resolve({ healthy: false, message: 'health check timed out' });
            }, timeoutMs);
            this.healthPending.set(id, { resolve, timer });
            this.channel.postMessage({ kind: 'health-check', id });
        });
    }
    terminate() {
        return this.channel.terminate();
    }
    handleMessage(message) {
        switch (message.kind) {
            case 'ready':
                this.ready = true;
                this.drain(this.readyWaiters, w => {
                    if (w.timer)
                        clearTimeout(w.timer);
                    w.resolve();
                });
                break;
            case 'error': {
                const error = new Error(message.error);
                this.drain(this.readyWaiters, w => {
                    if (w.timer)
                        clearTimeout(w.timer);
                    w.reject(error);
                });
                break;
            }
            case 'lifecycle-result': {
                const waiter = this.pending.get(message.id);
                if (!waiter)
                    return;
                this.pending.delete(message.id);
                if (waiter.timer)
                    clearTimeout(waiter.timer);
                if (message.ok)
                    waiter.resolve();
                else
                    waiter.reject(new Error(message.error));
                break;
            }
            case 'cap':
                void this.handleCapRequest(message);
                break;
            case 'hook-subscribe':
                this.onHookSubscribe?.(message.event, message.priority);
                break;
            case 'log':
                this.onLog?.(message.level, message.message, message.meta);
                break;
            case 'hook-result': {
                const waiter = this.hookPending.get(message.id);
                if (!waiter)
                    return;
                this.hookPending.delete(message.id);
                clearTimeout(waiter.timer);
                const result = { continue: message.continue };
                if (message.data !== undefined)
                    result.data = message.data;
                waiter.resolve(result);
                break;
            }
            case 'health-result': {
                const waiter = this.healthPending.get(message.id);
                if (!waiter)
                    return;
                this.healthPending.delete(message.id);
                clearTimeout(waiter.timer);
                waiter.resolve({ healthy: message.healthy, message: message.message });
                break;
            }
        }
    }
    async handleCapRequest(message) {
        if (!this.capDispatcher) {
            this.channel.postMessage({ kind: 'cap-result', id: message.id, ok: false, error: 'no capability dispatcher' });
            return;
        }
        try {
            const result = await this.capDispatcher(message.verb, message.args);
            this.channel.postMessage({ kind: 'cap-result', id: message.id, ok: true, result });
        }
        catch (error) {
            this.channel.postMessage({
                kind: 'cap-result',
                id: message.id,
                ok: false,
                error: error instanceof Error ? error.message : String(error),
            });
        }
    }
    handleExit(code) {
        this.dead = true;
        const error = new Error(`plugin worker exited unexpectedly (code ${code})`);
        this.drain(this.readyWaiters, w => {
            if (w.timer)
                clearTimeout(w.timer);
            w.reject(error);
        });
        this.pending.forEach(waiter => {
            if (waiter.timer)
                clearTimeout(waiter.timer);
            waiter.reject(error);
        });
        this.pending.clear();
        this.healthPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ healthy: false, message: 'plugin worker exited' });
        });
        this.healthPending.clear();
        this.hookPending.forEach(({ resolve, timer }) => {
            clearTimeout(timer);
            resolve({ continue: true });
        });
        this.hookPending.clear();
    }
    drain(waiters, fn) {
        const current = waiters.splice(0, waiters.length);
        current.forEach(fn);
    }
}
exports.PluginWorkerHost = PluginWorkerHost;
//# sourceMappingURL=plugin-worker-host.js.map