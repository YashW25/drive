import type { IncomingMessage } from '../interfaces/whatsapp-engine.interface';
export declare function inboundMediaMaxBytes(): number;
export declare function inboundMediaConcurrency(): number;
export declare function coerceDeclaredSize(value: unknown): number;
type InboundMedia = NonNullable<IncomingMessage['media']>;
export declare function capInboundMedia(args: {
    mimetype: string;
    filename?: string;
    sizeBytes: number;
    toBase64: () => string;
    maxBytes?: number;
}): InboundMedia;
export {};
