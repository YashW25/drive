import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Webhook } from './entities/webhook.entity';
import { CreateWebhookDto, UpdateWebhookDto } from './dto';
import { LidMappingStoreService } from '../../engine/identity/lid-mapping-store.service';
import { HookManager } from '../../core/hooks';
export interface WebhookPayload {
    event: string;
    timestamp: string;
    sessionId: string;
    idempotencyKey: string;
    deliveryId: string;
    data: Record<string, unknown>;
}
export interface WebhookJobData {
    webhookId: string;
    url: string;
    event: string;
    payload: WebhookPayload;
    signature: string;
    headers: Record<string, string>;
    attempt: number;
    maxRetries: number;
}
export declare class WebhookService {
    private readonly webhookRepository;
    private readonly configService;
    private readonly hookManager;
    private readonly lidMappingStore?;
    private readonly webhookQueue?;
    private readonly logger;
    private readonly queueEnabled;
    constructor(webhookRepository: Repository<Webhook>, configService: ConfigService, hookManager: HookManager, lidMappingStore?: LidMappingStoreService | undefined, webhookQueue?: Queue<WebhookJobData> | undefined);
    private validateWebhookUrl;
    create(sessionId: string, dto: CreateWebhookDto): Promise<Webhook>;
    findBySession(sessionId: string): Promise<Webhook[]>;
    findAll(allowedSessions?: string[] | null): Promise<Webhook[]>;
    findOne(sessionId: string, id: string): Promise<Webhook>;
    update(sessionId: string, id: string, dto: UpdateWebhookDto): Promise<Webhook>;
    delete(sessionId: string, id: string): Promise<void>;
    test(sessionId: string, webhookId: string): Promise<{
        success: boolean;
        statusCode?: number;
        error?: string;
    }>;
    dispatch(sessionId: string, event: string, data: Record<string, unknown>): Promise<void>;
    private deliverWebhook;
    private sanitizeCustomHeaders;
    private generateSignature;
    private delay;
}
