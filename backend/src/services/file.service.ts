import crypto from 'crypto';
import path from 'path';
import { prisma } from '../config/db.js';
import { StorageFactory } from '../storage/StorageFactory.js';
import { PreviewService } from './preview.service.js';

export class FileService {
  /**
   * Upload file and save metadata
   */
  static async uploadFile(
    userId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string,
    folderId?: string | null,
    allowDuplicate: boolean = true
  ) {
    const size = BigInt(fileBuffer.length);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const ext = path.extname(filename).toLowerCase().replace('.', '') || 'bin';

    // 1. Duplicate detection check
    const existingDuplicate = await prisma.file.findFirst({
      where: {
        userId,
        hash,
        isTrashed: false,
        deletedAt: null,
      },
    });

    if (existingDuplicate && !allowDuplicate) {
      return {
        isDuplicate: true,
        existingFile: {
          id: existingDuplicate.id,
          name: existingDuplicate.name,
          size: Number(existingDuplicate.size),
          createdAt: existingDuplicate.createdAt,
        },
      };
    }

    // 2. Storage Provider Upload (TelegramStorageProvider / LocalStorageProvider)
    const storageProvider = StorageFactory.getProvider();
    const storageResult = await storageProvider.upload(fileBuffer, {
      filename,
      mimeType,
      size: fileBuffer.length,
      userId,
    });

    // 3. Database Metadata Creation
    const fileRecord = await prisma.file.create({
      data: {
        userId,
        folderId: folderId || null,
        name: filename,
        originalName: filename,
        mimeType,
        extension: ext,
        size,
        hash,
        storageProvider: storageResult.provider,
        storageObjectId: storageResult.objectId,
        telegramFileId: storageResult.providerSpecific.telegramFileId,
        telegramMessageId: storageResult.providerSpecific.telegramMessageId,
        telegramChatId: storageResult.providerSpecific.telegramChatId,
      },
    });

    // 4. Initial Version Entry
    await prisma.fileVersion.create({
      data: {
        fileId: fileRecord.id,
        versionNumber: 1,
        size,
        hash,
        storageProvider: storageResult.provider,
        storageObjectId: storageResult.objectId,
        telegramFileId: storageResult.providerSpecific.telegramFileId,
        createdByUserId: userId,
      },
    });

    // 5. Generate Preview/Thumbnail
    await PreviewService.generatePreview(fileRecord.id, mimeType, undefined, fileBuffer);

    // 6. Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'FILE_UPLOAD',
        resourceType: 'FILE',
        resourceId: fileRecord.id,
        metadataJson: JSON.stringify({ filename, size: fileBuffer.length }),
      },
    });

    return {
      isDuplicate: false,
      file: fileRecord,
    };
  }

  /**
   * Upload a new version for an existing file
   */
  static async uploadNewVersion(
    userId: string,
    fileId: string,
    fileBuffer: Buffer,
    filename: string,
    mimeType: string
  ) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
      include: { fileVersions: true },
    });
    if (!file) throw new Error('File not found or access denied.');

    const size = BigInt(fileBuffer.length);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const storageProvider = StorageFactory.getProvider();
    const storageResult = await storageProvider.upload(fileBuffer, {
      filename,
      mimeType,
      size: fileBuffer.length,
      userId,
    });

    const nextVersionNumber = file.fileVersions.length + 1;

    const newVersion = await prisma.fileVersion.create({
      data: {
        fileId: file.id,
        versionNumber: nextVersionNumber,
        size,
        hash,
        storageProvider: storageResult.provider,
        storageObjectId: storageResult.objectId,
        telegramFileId: storageResult.providerSpecific.telegramFileId,
        createdByUserId: userId,
      },
    });

    const updatedFile = await prisma.file.update({
      where: { id: file.id },
      data: {
        size,
        hash,
        storageObjectId: storageResult.objectId,
        telegramFileId: storageResult.providerSpecific.telegramFileId,
        telegramMessageId: storageResult.providerSpecific.telegramMessageId,
        telegramChatId: storageResult.providerSpecific.telegramChatId,
        currentVersionId: newVersion.id,
      },
    });

    return { file: updatedFile, version: newVersion };
  }

  /**
   * Download stream or buffer for a file
   */
  static async getDownloadStream(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    });
    if (!file) throw new Error('File not found or access denied.');

    const storageProvider = StorageFactory.getProvider();
    const downloadRes = await storageProvider.download(file.storageObjectId);

    return {
      stream: downloadRes.stream,
      filename: file.name,
      mimeType: file.mimeType,
      size: Number(file.size),
    };
  }

  /**
   * Get File details & versions
   */
  static async getFileDetails(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({
      where: { id: fileId, userId },
      include: {
        fileVersions: true,
        previews: true,
        folder: true,
      },
    });
    if (!file) throw new Error('File not found');

    return file;
  }

  /**
   * File Operations: Rename, Move, Copy, Star, Trash, Restore, Delete Permanently
   */
  static async renameFile(userId: string, fileId: string, newName: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    return prisma.file.update({
      where: { id: fileId },
      data: { name: newName.trim() },
    });
  }

  static async moveFile(userId: string, fileId: string, targetFolderId: string | null) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    return prisma.file.update({
      where: { id: fileId },
      data: { folderId: targetFolderId },
    });
  }

  static async makeCopy(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    const copyName = `Copy of ${file.name}`;
    return prisma.file.create({
      data: {
        userId,
        folderId: file.folderId,
        name: copyName,
        originalName: file.originalName,
        mimeType: file.mimeType,
        extension: file.extension,
        size: file.size,
        hash: file.hash,
        storageProvider: file.storageProvider,
        storageObjectId: file.storageObjectId,
        telegramFileId: file.telegramFileId,
        telegramMessageId: file.telegramMessageId,
        telegramChatId: file.telegramChatId,
      },
    });
  }

  static async toggleStarFile(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    return prisma.file.update({
      where: { id: fileId },
      data: { isStarred: !file.isStarred },
    });
  }

  static async trashFile(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    const now = new Date();
    await prisma.file.update({
      where: { id: fileId },
      data: { isTrashed: true, trashedAt: now },
    });

    await prisma.trashItem.upsert({
      where: {
        userId_itemType_itemId: {
          userId,
          itemType: 'FILE',
          itemId: fileId,
        },
      },
      create: {
        userId,
        itemType: 'FILE',
        itemId: fileId,
        deletedAt: now,
        autoDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: { deletedAt: now },
    });

    return true;
  }

  static async restoreFile(userId: string, fileId: string) {
    await prisma.file.update({
      where: { id: fileId },
      data: { isTrashed: false, trashedAt: null },
    });

    await prisma.trashItem.deleteMany({
      where: { userId, itemType: 'FILE', itemId: fileId },
    });

    return true;
  }

  static async deleteFilePermanently(userId: string, fileId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    const storageProvider = StorageFactory.getProvider();
    await storageProvider.delete(file.storageObjectId);

    await prisma.file.delete({ where: { id: fileId } });
    await prisma.trashItem.deleteMany({
      where: { userId, itemType: 'FILE', itemId: fileId },
    });

    return true;
  }

  /**
   * Views: Starred, Recent, Trash, Storage Analytics
   */
  static async getStarred(userId: string) {
    const folders = await prisma.folder.findMany({
      where: { userId, isStarred: true, isTrashed: false },
    });
    const files = await prisma.file.findMany({
      where: { userId, isStarred: true, isTrashed: false, deletedAt: null },
      include: { previews: true },
    });
    return { folders, files };
  }

  static async getRecent(userId: string) {
    const files = await prisma.file.findMany({
      where: { userId, isTrashed: false, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      take: 30,
      include: { previews: true },
    });
    return files;
  }

  static async getTrash(userId: string) {
    const folders = await prisma.folder.findMany({
      where: { userId, isTrashed: true },
    });
    const files = await prisma.file.findMany({
      where: { userId, isTrashed: true },
      include: { previews: true },
    });
    return { folders, files };
  }

  static async emptyTrash(userId: string) {
    const trashedFiles = await prisma.file.findMany({
      where: { userId, isTrashed: true },
    });

    const storageProvider = StorageFactory.getProvider();
    for (const file of trashedFiles) {
      await storageProvider.delete(file.storageObjectId);
      await prisma.file.delete({ where: { id: file.id } });
    }

    await prisma.folder.deleteMany({
      where: { userId, isTrashed: true },
    });

    await prisma.trashItem.deleteMany({ where: { userId } });
    return true;
  }

  static async emptyDrive(userId: string) {
    const allFiles = await prisma.file.findMany({
      where: { userId },
    });

    const storageProvider = StorageFactory.getProvider();
    for (const file of allFiles) {
      try {
        await storageProvider.delete(file.storageObjectId);
      } catch (e) {
        // Storage delete best effort
      }
      await prisma.file.deleteMany({ where: { id: file.id } });
    }

    await prisma.folder.deleteMany({
      where: { userId },
    });

    await prisma.trashItem.deleteMany({ where: { userId } });
    return true;
  }


  static async getStorageDashboard(userId: string) {
    const files = await prisma.file.findMany({
      where: { userId, deletedAt: null },
    });
    const foldersCount = await prisma.folder.count({ where: { userId } });

    let totalBytes = 0;
    const categoryBytes: Record<string, number> = {
      Documents: 0,
      Images: 0,
      Videos: 0,
      Audio: 0,
      Archives: 0,
      Other: 0,
    };

    files.forEach((f) => {
      const bytes = Number(f.size);
      totalBytes += bytes;

      if (f.mimeType.startsWith('image/')) categoryBytes.Images += bytes;
      else if (f.mimeType.startsWith('video/')) categoryBytes.Videos += bytes;
      else if (f.mimeType.startsWith('audio/')) categoryBytes.Audio += bytes;
      else if (
        f.mimeType.includes('pdf') ||
        f.mimeType.includes('word') ||
        f.mimeType.includes('text') ||
        f.mimeType.includes('csv')
      )
        categoryBytes.Documents += bytes;
      else if (f.mimeType.includes('zip') || f.mimeType.includes('tar') || f.mimeType.includes('rar'))
        categoryBytes.Archives += bytes;
      else categoryBytes.Other += bytes;
    });

    return {
      totalBytes,
      totalFiles: files.length,
      totalFolders: foldersCount,
      categories: categoryBytes,
    };
  }
}
