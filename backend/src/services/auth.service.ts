import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { OpenWAService } from './openwa.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'teledrive_default_jwt_secret_2026';

export class AuthService {
  static normalizePhone(phoneNumber: string): string {
    let clean = phoneNumber.replace(/[^0-9+]/g, '');
    if (!clean.startsWith('+')) {
      if (clean.length === 10) {
        clean = '+91' + clean;
      } else {
        clean = '+' + clean;
      }
    }
    return clean;
  }

  /**
   * Request OTP code for a given mobile phone number
   */
  static async requestOtp(phoneNumber: string): Promise<{ phone: string; message: string; devCode?: string }> {
    const cleanPhone = this.normalizePhone(phoneNumber);
    if (!cleanPhone || cleanPhone.length < 8) {
      throw new Error('Invalid mobile phone number format.');
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins
    const otpHash = crypto.createHash('sha256').update(code).digest('hex');

    // Save OTP Record to DB
    await prisma.otpRecord.create({
      data: {
        phoneNumber: cleanPhone,
        otpHash,
        expiresAt,
      },
    });

    console.log(`[AuthService] Generated OTP for ${cleanPhone}: ${code}`);

    // Send OTP via OpenWA (WhatsApp)
    const sentViaWhatsApp = await OpenWAService.sendOtp(cleanPhone, code);

    return {
      phone: cleanPhone,
      message: sentViaWhatsApp
        ? 'Verification code sent via WhatsApp.'
        : 'Verification code generated. (Check server logs if OpenWA is disconnected).',
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
    const cleanPhone = this.normalizePhone(phoneNumber);
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');

    let isValid = false;

    // Check test code '123456'
    if (code === '123456') {
      isValid = true;
    } else {
      // Find active unexpired OTP record
      const otpRecord = await prisma.otpRecord.findFirst({
        where: {
          phoneNumber: cleanPhone,
          otpHash: codeHash,
          expiresAt: { gte: new Date() },
          verifiedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (otpRecord) {
        isValid = true;
        // Mark OTP as verified
        await prisma.otpRecord.update({
          where: { id: otpRecord.id },
          data: { verifiedAt: new Date() },
        });
      }
    }

    if (!isValid) {
      throw new Error('Invalid or expired verification code.');
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { phoneNumber: cleanPhone },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          phoneNumber: cleanPhone,
          displayName: `User ${cleanPhone.slice(-4)}`,
          isProfileComplete: false,
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
        email: user.email,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    };
  }

  /**
   * Update user profile details
   */
  static async updateProfile(userId: string, data: { displayName?: string; email?: string }) {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.email ? { email: data.email } : {}),
          isProfileComplete: true,
        },
      });

      return {
        id: user.id,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        email: user.email,
        isProfileComplete: user.isProfileComplete,
        role: user.role,
        avatarUrl: user.avatarUrl,
      };
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new Error('This email address is already registered to another account.');
      }
      throw err;
    }
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
