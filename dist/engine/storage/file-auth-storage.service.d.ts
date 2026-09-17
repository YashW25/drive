import { IAuthStorageProvider } from './auth-storage.interface';
import type { AuthenticationState } from '@whiskeysockets/baileys';
export declare class FileAuthStorageProvider implements IAuthStorageProvider {
    private readonly baseAuthDir;
    constructor(baseAuthDir: string);
    useAuthState(sessionId: string): Promise<{
        state: AuthenticationState;
        saveCreds: () => Promise<void>;
    }>;
    clearAuthState(sessionId: string): Promise<void>;
}
