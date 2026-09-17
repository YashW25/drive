import type { AuthenticationState } from '@whiskeysockets/baileys';
export interface IAuthStorageProvider {
    useAuthState(sessionId: string): Promise<{
        state: AuthenticationState;
        saveCreds: () => Promise<void>;
    }>;
    clearAuthState(sessionId: string): Promise<void>;
}
