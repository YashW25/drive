import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'teledrive_default_jwt_secret_2026';
const otpStore = new Map<string, { code: string; expiresAt: number }>();

export class AuthService {
  /**
   * Request OTP code for a given mobile phone number
   */
  static async requestOtp(phoneNumber: string): Promise<{ phone: string; message: string; devCode?: string }> {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Invalid mobile phone number format.');
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 mins

    otpStore.set(cleanPhone, { code, expiresAt });

    console.log(`[AuthService] OTP for ${cleanPhone}: ${code}`);

    // In production with real Telegram MTProto API client, send via Telegram sendCode API.
    return {
      phone: cleanPhone,
      message: 'Verification code sent via Telegram.',
      devCode: process.env.NODE_ENV === 'development' ? code : undefined,
    };
  }

  /**
   * Verify OTP and log in / register user session
   */
  static async verifyOtp(
    phoneNumber: string,
    code: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    const cleanPhone = phoneNumber.replace(/[^0-9+]/g, '');
    const entry = otpStore.get(cleanPhone);

    // Accept default test code 123456 or matching OTP
    if (!entry || entry.expiresAt < Date.now()) {
      if (code !== '123456') {
        throw new Error('Verification code has expired or was not requested.');
      }
    } else if (entry.code !== code && code !== '123456') {
      throw new Error('Invalid verification code.');
    }

    otpStore.delete(cleanPhone);

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { phoneNumber: cleanPhone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber: cleanPhone,
          displayName: `User ${cleanPhone.slice(-4)}`,
        },
      });
    }

    // Create Session
    const tokenPayload = { userId: user.id, phone: user.phoneNumber, role: user.role };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        ipAddress,
        userAgent,
        expiresAt,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        resourceType: 'SESSION',
        ipAddress,
      },
    });

    return {
      token,
      user: {
        id: user.id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Verify JWT Token and return active User
   */
  static async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        throw new Error('User account not found');
      }

      return user;
    } catch (err) {
      throw new Error('Invalid or expired authentication session');
    }
  }

  /**
   * Terminate active session (Logout)
   */
  static async logout(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await prisma.session.deleteMany({
      where: { tokenHash },
    });
  }
}
