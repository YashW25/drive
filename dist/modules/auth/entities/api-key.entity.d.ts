import { User } from './user.entity';
export declare enum ApiKeyRole {
    ADMIN = "admin",
    OPERATOR = "operator",
    VIEWER = "viewer"
}
export declare class ApiKey {
    id: string;
    name: string;
    userId: string;
    user: User;
    keyHash: string;
    keyPrefix: string;
    role: ApiKeyRole;
    allowedIps: string[] | null;
    allowedSessions: string[] | null;
    isActive: boolean;
    expiresAt: Date | null;
    lastUsedAt: Date | null;
    usageCount: number;
    createdAt: Date;
    updatedAt: Date;
}
