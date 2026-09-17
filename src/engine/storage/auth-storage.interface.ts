import type { AuthenticationState } from '@whiskeysockets/baileys';

/**
 * Storage interface abstracting Baileys multi-file authentication state.
 * Allows transparently backing the session identity store via the file system,
 * database (PostgreSQL/SQLite), Redis, or S3, protecting the state on ephemeral containers.
 */
export interface IAuthStorageProvider {
  /** Retrieves the Baileys auth state and a saveCreds function for the given session. */
  useAuthState(sessionId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }>;
  
  /** Clears the auth state for the session (e.g., terminal logout). */
  clearAuthState(sessionId: string): Promise<void>;
}
