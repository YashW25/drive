import type { Chat, Contact as BaileysContact, WAMessage, WAMessageKey } from '@whiskeysockets/baileys';
import { ChatSummary, Contact } from '../interfaces/whatsapp-engine.interface';
import type { LidMappingStore } from '../identity/lid-mapping-store.service';
type BaileysContactWithPhone = BaileysContact & {
    phoneNumber?: string;
};
export declare class BaileysSessionStore {
    private readonly lidStore?;
    private readonly sessionId?;
    private readonly contacts;
    private readonly chats;
    private readonly lastMessages;
    private readonly lidToPn;
    constructor(lidStore?: LidMappingStore | undefined, sessionId?: string | undefined);
    upsertContacts(records?: Partial<BaileysContactWithPhone>[]): void;
    upsertChats(records?: Partial<Chat>[]): void;
    addLidMappings(mappings?: {
        lid?: string;
        pn?: string;
    }[]): void;
    recordKeyLidMappings(key: Pick<WAMessageKey, 'senderLid' | 'senderPn' | 'participantLid' | 'participantPn'>): void;
    private persistLidMapping;
    recordMessage(msg: WAMessage): void;
    listContacts(): Contact[];
    findContact(id: string): Contact | null;
    listChats(): ChatSummary[];
    lastMessage(chatId: string): {
        key: WAMessageKey;
        timestamp: number;
    } | null;
    resolvePhone(id: string): string | null;
    toNeutralJid(jid: string): string;
    toEngineJid(jid: string): string;
    private toNeutralContact;
    private toNeutralChat;
    private resolveContactName;
    private contactDisplayName;
    private toUnixSeconds;
}
export {};
