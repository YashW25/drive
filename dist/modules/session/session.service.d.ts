import { OnModuleDestroy, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { Repository, DataSource } from 'typeorm';
import { Session, SessionStatus } from './entities/session.entity';
import { Message } from '../message/entities/message.entity';
import { CreateSessionDto } from './dto';
import { EngineFactory } from '../../engine/engine.factory';
import { ListOptions } from '../../common/utils/paginate';
import { IWhatsAppEngine, ChatSummary, ChatState } from '../../engine/interfaces/whatsapp-engine.interface';
import { EventsGateway } from '../events/events.gateway';
import { WebhookService } from '../webhook/webhook.service';
import { HookManager } from '../../core/hooks';
export declare const ACK_RECONCILE_DELAY_MS = 750;
export declare function resolveReconnectConfig(config: {
    maxReconnectAttempts?: unknown;
    reconnectBaseDelay?: unknown;
} | null): {
    maxAttempts: number;
    baseDelay: number;
};
export declare function clampReconnectDelay(rawDelay: number, baseDelay: number): number;
export declare class SessionService implements OnModuleDestroy, OnModuleInit, OnApplicationBootstrap {
    private readonly sessionRepository;
    private readonly messageRepository;
    private readonly dataSource;
    private readonly engineFactory;
    private readonly eventsGateway;
    private readonly webhookService;
    private readonly hookManager;
    private readonly logger;
    private engines;
    private readonly lidPhoneCache;
    private static readonly LID_PHONE_CACHE_MAX;
    private sessionErrors;
    private reconnectStates;
    private readonly lastDispatchedStatus;
    private stoppingSessions;
    private initializingSessions;
    private reactionChains;
    constructor(sessionRepository: Repository<Session>, messageRepository: Repository<Message>, dataSource: DataSource, engineFactory: EngineFactory, eventsGateway: EventsGateway, webhookService: WebhookService, hookManager: HookManager);
    onModuleInit(): Promise<void>;
    onApplicationBootstrap(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private destroyEngineSafely;
    private teardownEngineSafely;
    create(dto: CreateSessionDto, ownerSupabaseId?: string): Promise<Session>;
    findAll(allowedSessions?: string[] | null, ownerSupabaseId?: string): Promise<Session[]>;
    findOne(id: string): Promise<Session>;
    private attachLastError;
    findByName(name: string): Promise<Session>;
    delete(id: string): Promise<void>;
    start(id: string): Promise<Session>;
    private isLiveEngine;
    private persistHistoryMessages;
    private initializeEngine;
    private applyReaction;
    private scheduleReconnect;
    private executeReconnect;
    private cancelReconnect;
    stop(id: string): Promise<Session>;
    forceKill(id: string): Promise<Session>;
    getQRCode(id: string): Promise<{
        qrCode: string;
        status: SessionStatus;
    }>;
    requestPairingCode(id: string, phoneNumber: string): Promise<{
        pairingCode: string;
        status: SessionStatus;
    }>;
    getEngine(id: string): IWhatsAppEngine | undefined;
    private resolveSenderPhone;
    getGroups(id: string, opts?: ListOptions): Promise<{
        id: string;
        name: string;
        linkedParentJID?: string | null;
    }[]>;
    getChats(id: string, opts?: ListOptions): Promise<ChatSummary[]>;
    sendSeen(id: string, chatId: string): Promise<boolean>;
    markUnread(id: string, chatId: string): Promise<boolean>;
    deleteChat(id: string, chatId: string): Promise<boolean>;
    sendChatState(id: string, chatId: string, state: ChatState): Promise<void>;
    private updateStatus;
    getStats(allowedSessions?: string[] | null): Promise<{
        total: number;
        active: number;
        ready: number;
        disconnected: number;
        byStatus: Record<string, number>;
        memoryUsage: {
            heapUsed: number;
            heapTotal: number;
            rss: number;
        };
    }>;
    getActiveCount(): number;
    isActive(id: string): boolean;
    private delay;
}
