import * as path from 'path';
import * as fs from 'fs';
import { IAuthStorageProvider } from './auth-storage.interface';
import type { AuthenticationState } from '@whiskeysockets/baileys';

/**
 * File-based implementation of the Baileys auth state storage provider.
 * This wraps Baileys' native `useMultiFileAuthState` to provide local file persistence.
 */
export class FileAuthStorageProvider implements IAuthStorageProvider {
  constructor(private readonly baseAuthDir: string) {}

  async useAuthState(sessionId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const authPath = path.join(this.baseAuthDir, sessionId);
    const { useMultiFileAuthState } = await import('@whiskeysockets/baileys');
    return await useMultiFileAuthState(authPath);
  }

  async clearAuthState(sessionId: string): Promise<void> {
    const authPath = path.join(this.baseAuthDir, sessionId);
    try {
      await fs.promises.rm(authPath, { recursive: true, force: true });
    } catch (err) {
      // Ignored if doesn't exist
    }
  }
}
