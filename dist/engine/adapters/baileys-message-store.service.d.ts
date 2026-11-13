import { Repository } from 'typeorm';
import type { WAMessage } from '@whiskeysockets/baileys';
import { BaileysStoredMessage } from './baileys-stored-message.entity';
import { BaileysMessageStore } from '../types/baileys.types';
import { Session } from '../../modules/session/entities/session.entity';
import { Message } from '../../modules/message/entities/message.entity';
export declare class BaileysMessageStoreService implements BaileysMessageStore {
    private readonly repo;
    private readonly sessionRepo?;
    private readonly messageRepo?;
    private readonly logger;
    private readonly orphanWarnedSessions;
    private baileysLib?;
    private loadLib;
    constructor(repo: Repository<BaileysStoredMessage>, sessionRepo?: Repository<Session> | undefined, messageRepo?: Repository<Message> | undefined);
    private resolveSessionId;
    put(sessionId: string, msg: WAMessage): Promise<void>;
    getMessage(sessionId: string, messageId: string): Promise<WAMessage | null>;
    clearSession(sessionId: string): Promise<void>;
    private enforceLimit;
}
