import { WebhookService } from './webhook.service';
import { WebhookResponseDto } from './dto';
import { ApiKey } from '../auth/entities/api-key.entity';
export declare class WebhooksListController {
    private readonly webhookService;
    constructor(webhookService: WebhookService);
    findAll(apiKey?: ApiKey): Promise<WebhookResponseDto[]>;
}
