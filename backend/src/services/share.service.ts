import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/db.js';
import { StorageFactory } from '../storage/StorageFactory.js';

export class ShareService {
  /**
   * Create or update share link for file/folder
   */
  static async createShareLink(
    userId: string,
    params: {
      fileId?: string;
      folderId?: string;
      permission?: 'VIEWER' | 'DOWNLOADER' | 'EDITOR';
      password?: string;
      expiresInDays?: number;
    }
  ) {
    const { fileId, folderId, permission = 'VIEWER', password, expiresInDays } = params;

    if (!fileId && !folderId) {
      throw new Error('Either fileId or folderId must be specified.');
    }

    if (fileId) {
      const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
      if (!file) throw new Error('File not found or access denied.');
    }

    if (folderId) {
      const folder = await prisma.folder.findFirst({ where: { id: folderId, userId } });
      if (!folder) throw new Error('Folder not found or access denied.');
    }

    const token = crypto.randomBytes(16).toString('hex');
    const passwordHash = password ? await bcrypt.hash(password, 10) : null;
    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const share = await prisma.share.create({
      data: {
        userId,
        fileId: fileId || null,
        folderId: folderId || null,
        token,
        permission,
        passwordHash,
        expiresAt,
      },
    });

    return {
      shareId: share.id,
      token: share.token,
      shareUrl: `/share/${share.token}`,
      permission: share.permission,
      expiresAt: share.expiresAt,
      hasPassword: Boolean(share.passwordHash),
    };
  }

  /**
   * Access public shared item by token
   */
  static async getSharedItem(token: string, password?: string) {
    const share = await prisma.share.findUnique({
      where: { token },
      include: {
        file: { include: { previews: true } },
        folder: true,
      },
    });

    if (!share || !share.isActive) {
      throw new Error('Share link is invalid or disabled.');
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      throw new Error('Share link has expired.');
    }

    if (share.passwordHash) {
      if (!password) {
        return { requiresPassword: true, token: share.token };
      }
      const match = await bcrypt.compare(password, share.passwordHash);
      if (!match) {
        throw new Error('Incorrect password for shared file.');
      }
    }

    // Increment access count
    await prisma.share.update({
      where: { id: share.id },
      data: { accessCount: { increment: 1 } },
    });

    return {
      requiresPassword: false,
      token: share.token,
      permission: share.permission,
      file: share.file,
      folder: share.folder,
    };
  }

  /**
   * Stream/download shared file by token
   */
  static async downloadSharedFile(token: string, password?: string) {
    const item = await this.getSharedItem(token, password);
    if (item.requiresPassword || !item.file) {
      throw new Error('Access denied.');
    }

    if (item.permission === 'VIEWER') {
      throw new Error('Download permission is restricted for this share link.');
    }

    const storageProvider = StorageFactory.getProvider();
    const res = await storageProvider.download(item.file.storageObjectId);

    return {
      stream: res.stream,
      filename: item.file.name,
      mimeType: item.file.mimeType,
      size: Number(item.file.size),
    };
  }

  /**
   * Revoke or delete share link
   */
  static async revokeShareLink(userId: string, shareId: string) {
    const share = await prisma.share.findFirst({ where: { id: shareId, userId } });
    if (!share) throw new Error('Share link not found.');

    return prisma.share.update({
      where: { id: shareId },
      data: { isActive: false },
    });
  }
}
