import { IAuthStorageProvider } from './auth-storage.interface';
import { AuthenticationState } from '@whiskeysockets/baileys';
export declare class SupabasePgAuthStorageProvider implements IAuthStorageProvider {
    private supabase;
    private readonly logger;
    constructor();
    useAuthState(sessionId: string): Promise<{
        state: AuthenticationState;
        saveCreds: () => Promise<void>;
    }>;
    clearAuthState(sessionId: string): Promise<void>;
}
