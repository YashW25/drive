import { SessionService } from '../session/session.service';
import type { Status, StatusResult, TextStatusOptions } from '../../engine/interfaces/whatsapp-engine.interface';
export declare class StatusService {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    getStatuses(sessionId: string): Promise<Status[]>;
    getContactStatus(sessionId: string, contactId: string): Promise<Status[]>;
    postTextStatus(sessionId: string, text: string, options?: TextStatusOptions): Promise<StatusResult>;
    postImageStatus(sessionId: string, media: {
        url?: string;
        base64?: string;
    }, caption?: string): Promise<StatusResult>;
    postVideoStatus(sessionId: string, media: {
        url?: string;
        base64?: string;
    }, caption?: string): Promise<StatusResult>;
    deleteStatus(sessionId: string, statusId: string): Promise<void>;
}
