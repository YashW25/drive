import { WorkerToHostMessage, HostToWorkerMessage } from './protocol';
export declare class WorkerCapabilityClient {
    private readonly post;
    private nextId;
    private readonly pending;
    constructor(post: (message: WorkerToHostMessage) => void);
    call(verb: string, args: unknown[]): Promise<unknown>;
    handleResult(message: Extract<HostToWorkerMessage, {
        kind: 'cap-result';
    }>): void;
}
export interface SandboxCapabilityContext {
    messages: {
        sendText(sessionId: string, chatId: string, text: string): Promise<unknown>;
        reply(sessionId: string, chatId: string, quotedMessageId: string, text: string): Promise<unknown>;
    };
    engine: {
        getGroupInfo(sessionId: string, groupId: string): Promise<unknown>;
        getContacts(sessionId: string): Promise<unknown>;
        getContactById(sessionId: string, contactId: string): Promise<unknown>;
        checkNumberExists(sessionId: string, phone: string): Promise<unknown>;
        getChats(sessionId: string): Promise<unknown>;
    };
    storage: {
        get(key: string): Promise<unknown>;
        set(key: string, value: unknown): Promise<unknown>;
        delete(key: string): Promise<unknown>;
        list(prefix?: string): Promise<unknown>;
    };
    net: {
        fetch(url: string, init?: unknown): Promise<unknown>;
    };
}
export declare function buildSandboxContext(client: WorkerCapabilityClient): SandboxCapabilityContext;
