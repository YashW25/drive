import { OnApplicationBootstrap } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MessageBatch, BatchStatus, BatchProgress } from './entities/message-batch.entity';
import { SendBulkMessageDto } from './dto/bulk-message.dto';
import { SessionService } from '../session/session.service';
import { MessageService } from './message.service';
export declare function resolveFinalBatchStatus(cancelled: boolean, stoppedOnError: boolean, progress: Pick<BatchProgress, 'sent' | 'failed'>): BatchStatus;
export declare function sanitizeBatchError(error: unknown): {
    code: string;
    message: string;
};
export declare class BulkMessageService implements OnApplicationBootstrap {
    private readonly batchRepository;
    private readonly sessionService;
    private readonly messageService;
    private readonly logger;
    private readonly processingBatches;
    constructor(batchRepository: Repository<MessageBatch>, sessionService: SessionService, messageService: MessageService);
    onApplicationBootstrap(): Promise<void>;
    createBatch(sessionId: string, dto: SendBulkMessageDto): Promise<MessageBatch>;
    getBatchStatus(sessionId: string, batchId: string): Promise<MessageBatch>;
    cancelBatch(sessionId: string, batchId: string): Promise<MessageBatch>;
    private processBatch;
    private applyVariables;
    private persistSentMessage;
    private sendMessage;
    private calculateDelay;
    private sleep;
}
