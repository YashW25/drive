import { DeliveryStatus, IncomingMessage, MessageType } from '../interfaces/whatsapp-engine.interface';
export declare function mapBaileysMessageType(contentType: string | undefined, isPtt?: boolean): MessageType;
export declare function mapBaileysStatus(status: number | null | undefined): DeliveryStatus | null;
export interface BaileysIncomingFields {
    id: string;
    remoteJid: string;
    fromMe: boolean;
    participant?: string;
    body: string;
    contentType: string | undefined;
    isPtt?: boolean;
    timestamp: number;
    pushName?: string;
    selfJid?: string;
    media?: IncomingMessage['media'];
    location?: IncomingMessage['location'];
    quotedMessage?: IncomingMessage['quotedMessage'];
}
export declare function buildIncomingMessageFromBaileys(fields: BaileysIncomingFields, normalizeJid?: (jid: string) => string): IncomingMessage;
