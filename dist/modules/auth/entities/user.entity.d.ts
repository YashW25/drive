import { ApiKey } from './api-key.entity';
export declare class User {
    id: string;
    supabaseId: string;
    email: string;
    apiKeys: ApiKey[];
    createdAt: Date;
    updatedAt: Date;
}
