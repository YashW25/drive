import { IAuthStorageProvider } from './auth-storage.interface';
import { IStorageProvider } from './storage.provider.interface';
import { AuthenticationState } from '@whiskeysockets/baileys';
export declare class RemoteAuthStorageProvider implements IAuthStorageProvider {
    private readonly storage;
    private readonly bucket;
    private readonly prefix;
    constructor(storage: IStorageProvider, bucket: string, prefix?: string);
    private getSessionPath;
    useAuthState(sessionId: string): Promise<{
        state: AuthenticationState;
        saveCreds: () => Promise<void>;
    }>;
    clearAuthState(sessionId: string): Promise<void>;
}
