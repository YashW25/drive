import { google } from 'googleapis';
import crypto from 'crypto';
import { prisma } from '../config/db.js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_SECRET
  ? crypto.createHash('sha256').update(process.env.ENCRYPTION_SECRET).digest()
  : crypto.createHash('sha256').update('teledrive-secret-key-2026').digest();

function encryptToken(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(encryptedData: string): string {
  if (!encryptedData) return '';
  try {
    const [ivHex, authTagHex, encryptedText] = encryptedData.split(':');
    if (!ivHex || !authTagHex || !encryptedText) return encryptedData; // fallback if plain
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return encryptedData; // fallback
  }
}

export class GoogleAuthService {
  private static getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'DEMO_GOOGLE_CLIENT_ID';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || 'DEMO_GOOGLE_CLIENT_SECRET';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/google/callback';

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  }

  static getAuthUrl(state: string): string {
    const oauth2Client = this.getOAuth2Client();
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state,
    });
  }

  static async handleAuthCallback(code: string, userId: string): Promise<any> {
    const oauth2Client = this.getOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    let email = 'connected-google-account@gmail.com';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userInfo = await oauth2.userinfo.get();
      if (userInfo.data.email) {
        email = userInfo.data.email;
      }
    } catch (err) {
      console.warn('Failed to fetch Google user email:', err);
    }

    const encryptedAccess = encryptToken(tokens.access_token || '');
    const encryptedRefresh = tokens.refresh_token ? encryptToken(tokens.refresh_token) : null;
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date) : new Date(Date.now() + 3600 * 1000);

    const connection = await prisma.googleConnection.upsert({
      where: { userId },
      update: {
        email,
        accessToken: encryptedAccess,
        ...(encryptedRefresh ? { refreshToken: encryptedRefresh } : {}),
        tokenExpiry: expiry,
        scopes: tokens.scope || '',
      },
      create: {
        userId,
        email,
        accessToken: encryptedAccess,
        refreshToken: encryptedRefresh,
        tokenExpiry: expiry,
        scopes: tokens.scope || '',
      },
    });

    return {
      userId: connection.userId,
      email: connection.email,
      connectedAt: connection.createdAt,
    };
  }

  static async getAuthenticatedClient(userId: string) {
    const connection = await prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      throw new Error('Google Drive account not connected');
    }

    const oauth2Client = this.getOAuth2Client();
    const accessToken = decryptToken(connection.accessToken);
    const refreshToken = connection.refreshToken ? decryptToken(connection.refreshToken) : null;

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken || undefined,
      expiry_date: connection.tokenExpiry.getTime(),
    });

    // Check if access token is expired or close to expiry
    if (connection.tokenExpiry.getTime() <= Date.now() + 60000 && refreshToken) {
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        if (credentials.access_token) {
          const newEncryptedAccess = encryptToken(credentials.access_token);
          const newExpiry = credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : new Date(Date.now() + 3600 * 1000);

          await prisma.googleConnection.update({
            where: { userId },
            data: {
              accessToken: newEncryptedAccess,
              tokenExpiry: newExpiry,
            },
          });
          oauth2Client.setCredentials(credentials);
        }
      } catch (refreshErr) {
        console.warn('Failed to refresh Google token:', refreshErr);
      }
    }

    return { oauth2Client, email: connection.email };
  }

  static async getConnectionStatus(userId: string) {
    const connection = await prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (!connection) {
      return { isConnected: false };
    }

    return {
      isConnected: true,
      email: connection.email,
      connectedAt: connection.createdAt,
      scopes: connection.scopes,
    };
  }

  static async disconnect(userId: string): Promise<boolean> {
    const connection = await prisma.googleConnection.findUnique({
      where: { userId },
    });

    if (connection) {
      try {
        const oauth2Client = this.getOAuth2Client();
        const accessToken = decryptToken(connection.accessToken);
        if (accessToken) {
          await oauth2Client.revokeToken(accessToken);
        }
      } catch (err) {
        // Best effort revoke
      }

      await prisma.googleConnection.delete({
        where: { userId },
      });
    }

    return true;
  }
}
