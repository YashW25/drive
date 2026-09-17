import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';
import { prisma } from '../config/db.js';
import { GoogleAuthService } from './google.auth.service.js';
import { StorageFactory } from '../storage/StorageFactory.js';

const db = prisma as any;

export class GoogleMigrationService {
  /**
   * Scans user's Google Drive recursively using pagination (pageSize=1000)
   */
  static async scanDrive(userId: string) {
    const { oauth2Client, email } = await GoogleAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Fetch total storage quota from Google Drive API
    let totalGoogleDriveBytes = BigInt(0);
    let usedGoogleDriveBytes = BigInt(0);

    try {
      const aboutRes = await drive.about.get({ fields: 'storageQuota, user' });
      const quota = aboutRes.data.storageQuota;
      if (quota) {
        if (quota.limit) totalGoogleDriveBytes = BigInt(quota.limit);
        if (quota.usage) usedGoogleDriveBytes = BigInt(quota.usage);
      }
    } catch (err) {
      console.warn('Failed to fetch Google Drive storage quota:', err);
    }

    // Cancel any previous pending SCANNING migrations
    await db.googleMigration.deleteMany({
      where: { userId, status: 'SCANNING' },
    });

    // Create a unique default backup folder name for today
    const dateStr = new Date().toISOString().split('T')[0];
    let defaultBackupName = `Google_drive_backup_${dateStr}`;
    let collisionCount = 1;

    while (
      await prisma.folder.findFirst({
        where: { userId, name: defaultBackupName, parentFolderId: null },
      })
    ) {
      collisionCount++;
      const suffix = collisionCount < 10 ? `0${collisionCount}` : `${collisionCount}`;
      defaultBackupName = `Google_drive_backup_${dateStr}_${suffix}`;
    }

    const migration = await db.googleMigration.create({
      data: {
        userId,
        backupFolderName: defaultBackupName,
        status: 'SCANNING',
        totalGoogleDriveBytes,
        usedGoogleDriveBytes,
      },
    });

    let totalFilesDiscovered = 0;
    let totalFoldersDiscovered = 0;
    let totalBytesDiscovered = BigInt(0);
    let unsupportedCount = 0;

    let nextPageToken: string | undefined = undefined;

    do {
      const response: drive_v3.Schema$FileList = (
        await drive.files.list({
          pageSize: 1000,
          fields: 'nextPageToken, files(id, name, mimeType, size, parents, modifiedTime, md5Checksum, webViewLink, capabilities)',
          pageToken: nextPageToken,
          q: 'trashed = false',
        })
      ).data;

      const files = response.files || [];
      nextPageToken = response.nextPageToken || undefined;

      const itemsToCreate: any[] = [];

      for (const file of files) {
        if (!file.id || !file.name) continue;

        const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
        const isWorkspace = file.mimeType?.startsWith('application/vnd.google-apps.') && !isFolder;
        const sizeBytes = file.size ? BigInt(file.size) : BigInt(0);

        if (isFolder) {
          totalFoldersDiscovered++;
        } else {
          totalFilesDiscovered++;
          totalBytesDiscovered += sizeBytes;
        }

        if (isWorkspace && !this.getWorkspaceExportFormat(file.mimeType!)) {
          unsupportedCount++;
        }

        let exportMime: string | undefined = undefined;
        let exportExt: string | undefined = undefined;

        if (isWorkspace) {
          const exportInfo = this.getWorkspaceExportFormat(file.mimeType!);
          if (exportInfo) {
            exportMime = exportInfo.mimeType;
            exportExt = exportInfo.extension;
          }
        }

        itemsToCreate.push({
          migrationId: migration.id,
          googleFileId: file.id,
          googleParentId: file.parents && file.parents.length > 0 ? file.parents[0] : null,
          name: file.name,
          mimeType: file.mimeType || 'application/octet-stream',
          isFolder,
          isWorkspaceFile: isWorkspace,
          exportMimeType: exportMime,
          exportExtension: exportExt,
          size: sizeBytes,
          md5Checksum: file.md5Checksum || null,
          googleModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
          googleWebViewLink: file.webViewLink || null,
          status: 'DISCOVERED',
        });
      }

      if (itemsToCreate.length > 0) {
        await db.googleMigrationItem.createMany({
          data: itemsToCreate,
        });
      }
    } while (nextPageToken);

    const updatedMigration = await db.googleMigration.update({
      where: { id: migration.id },
      data: {
        status: 'SCAN_COMPLETED',
        totalFilesDiscovered,
        totalFoldersDiscovered,
        totalBytesDiscovered,
        unsupportedCount,
      },
    });

    const itemsList = await db.googleMigrationItem.findMany({
      where: { migrationId: updatedMigration.id },
      select: {
        id: true,
        googleFileId: true,
        googleParentId: true,
        name: true,
        mimeType: true,
        isFolder: true,
        isWorkspaceFile: true,
        size: true,
      },
    });

    return {
      migrationId: updatedMigration.id,
      accountEmail: email,
      backupFolderName: defaultBackupName,
      totalFiles: totalFilesDiscovered,
      totalFolders: totalFoldersDiscovered,
      totalBytes: totalBytesDiscovered.toString(),
      totalGoogleDriveBytes: totalGoogleDriveBytes.toString(),
      usedGoogleDriveBytes: usedGoogleDriveBytes.toString(),
      unsupportedCount,
      items: itemsList.map((i: any) => ({ ...i, size: i.size.toString() })),
    };
  }

  /**
   * Helper: Maps Google Workspace MIME types to standard export formats
   */
  private static getWorkspaceExportFormat(googleMimeType: string): { mimeType: string; extension: string } | null {
    switch (googleMimeType) {
      case 'application/vnd.google-apps.document':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: 'docx',
        };
      case 'application/vnd.google-apps.spreadsheet':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        };
      case 'application/vnd.google-apps.presentation':
        return {
          mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          extension: 'pptx',
        };
      case 'application/vnd.google-apps.drawing':
        return { mimeType: 'image/png', extension: 'png' };
      case 'application/vnd.google-apps.script':
        return { mimeType: 'application/vnd.google-apps.script+json', extension: 'json' };
      case 'application/vnd.google-apps.form':
      case 'application/vnd.google-apps.site':
        return { mimeType: 'application/pdf', extension: 'pdf' };
      default:
        return null;
    }
  }

  /**
   * Launches background migration execution
   */
  static async startMigration(
    userId: string,
    migrationId: string,
    customFolderName?: string,
    deleteOriginals: boolean = false,
    selectedGoogleFileIds?: string[]
  ) {
    const migration = await db.googleMigration.findFirst({
      where: { id: migrationId, userId },
    });

    if (!migration) {
      throw new Error('Migration record not found');
    }

    if (selectedGoogleFileIds && selectedGoogleFileIds.length > 0) {
      // Mark non-selected files as SKIPPED
      await db.googleMigrationItem.updateMany({
        where: {
          migrationId,
          googleFileId: { notIn: selectedGoogleFileIds },
          isFolder: false,
        },
        data: {
          status: 'SKIPPED',
          errorReason: 'Deselected by User',
        },
      });

      // Find all items to build ancestor tree
      const allItems = await db.googleMigrationItem.findMany({
        where: { migrationId },
      });

      const selectedSet = new Set(selectedGoogleFileIds);
      const requiredFolderIds = new Set<string>();

      // Collect ancestor parent folders for selected files
      allItems.forEach((item: any) => {
        if (selectedSet.has(item.googleFileId)) {
          let parentId = item.googleParentId;
          while (parentId && parentId !== 'root') {
            requiredFolderIds.add(parentId);
            const parentItem = allItems.find((i: any) => i.googleFileId === parentId);
            parentId = parentItem ? parentItem.googleParentId : null;
          }
        }
      });

      // Mark non-required folders as SKIPPED
      await db.googleMigrationItem.updateMany({
        where: {
          migrationId,
          isFolder: true,
          googleFileId: { notIn: Array.from(requiredFolderIds) },
        },
        data: {
          status: 'SKIPPED',
          errorReason: 'No selected child items',
        },
      });

      // Calculate selected totals
      const activeFileItems = allItems.filter(
        (i: any) => !i.isFolder && selectedSet.has(i.googleFileId)
      );
      const totalSelectedBytes = activeFileItems.reduce(
        (acc: bigint, i: any) => acc + BigInt(i.size || 0),
        BigInt(0)
      );
      const skippedCount = await db.googleMigrationItem.count({
        where: { migrationId, status: 'SKIPPED', isFolder: false },
      });

      await db.googleMigration.update({
        where: { id: migrationId },
        data: {
          totalFilesDiscovered: selectedGoogleFileIds.length,
          totalFoldersDiscovered: requiredFolderIds.size,
          totalBytesDiscovered: totalSelectedBytes,
          skippedCount,
        },
      });
    }

    const backupFolderName = customFolderName?.trim() || migration.backupFolderName;

    // Create root backup folder in TeleDrive
    const rootFolder = await prisma.folder.create({
      data: {
        userId,
        name: backupFolderName,
      },
    });

    await db.googleMigration.update({
      where: { id: migrationId },
      data: {
        backupFolderName,
        backupFolderId: rootFolder.id,
        deleteOriginals,
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    // Run background worker processing asynchronously
    this.processMigrationAsync(userId, migrationId).catch((err: any) => {
      console.error(`Migration ${migrationId} error:`, err);
    });

    return {
      migrationId,
      backupFolderName,
      status: 'IN_PROGRESS',
    };
  }

  /**
   * Resumes interrupted migration
   */
  static async resumeMigration(userId: string, migrationId: string) {
    const migration = await db.googleMigration.findFirst({
      where: { id: migrationId, userId },
    });

    if (!migration) {
      throw new Error('Migration not found');
    }

    await db.googleMigration.update({
      where: { id: migrationId },
      data: {
        status: 'IN_PROGRESS',
      },
    });

    this.processMigrationAsync(userId, migrationId).catch((err: any) => {
      console.error(`Migration ${migrationId} resume error:`, err);
    });

    return { migrationId, status: 'IN_PROGRESS' };
  }

  /**
   * Cancels an in-progress migration
   */
  static async cancelMigration(userId: string, migrationId: string) {
    const migration = await db.googleMigration.findFirst({
      where: { id: migrationId, userId },
    });

    if (!migration) {
      throw new Error('Migration not found');
    }

    await db.googleMigration.update({
      where: { id: migrationId },
      data: {
        status: 'CANCELLED',
        currentFileName: null,
        currentFileStatus: 'Migration cancelled by user.',
      },
    });

    return { migrationId, status: 'CANCELLED' };
  }

  /**
   * Asynchronous background job process loop
   */
  private static async processMigrationAsync(userId: string, migrationId: string) {
    const migration = await db.googleMigration.findUnique({
      where: { id: migrationId },
      include: { items: true },
    });

    if (!migration || !migration.backupFolderId) return;

    const isCancelled = async () => {
      const current = await db.googleMigration.findUnique({
        where: { id: migrationId },
        select: { status: true },
      });
      return current?.status === 'CANCELLED';
    };

    if (await isCancelled()) return;

    const { oauth2Client } = await GoogleAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });
    const storageProvider = StorageFactory.getProvider();

    // STEP 1: Recreate Folder Structure for active folders only
    const folderItems = migration.items.filter((item: any) => item.isFolder && item.status !== 'SKIPPED');
    const googleFolderIdToTeleDriveFolderId = new Map<string, string>();
    googleFolderIdToTeleDriveFolderId.set('root', migration.backupFolderId);

    // Build folder map order using BFS/level-order
    let pendingFolders = [...folderItems];
    let passCount = 0;

    while (pendingFolders.length > 0 && passCount < 100) {
      passCount++;
      const nextPending: typeof folderItems = [];

      for (const folderItem of pendingFolders) {
        let parentTeleDriveFolderId = migration.backupFolderId;

        if (folderItem.googleParentId && googleFolderIdToTeleDriveFolderId.has(folderItem.googleParentId)) {
          parentTeleDriveFolderId = googleFolderIdToTeleDriveFolderId.get(folderItem.googleParentId)!;
        } else if (folderItem.googleParentId && !googleFolderIdToTeleDriveFolderId.has(folderItem.googleParentId)) {
          // Parent not created yet, postpone to next pass
          nextPending.push(folderItem);
          continue;
        }

        // Create or find existing folder in TeleDrive
        let teleFolder = await prisma.folder.findFirst({
          where: {
            userId,
            parentFolderId: parentTeleDriveFolderId,
            name: folderItem.name,
          },
        });

        if (!teleFolder) {
          teleFolder = await prisma.folder.create({
            data: {
              userId,
              parentFolderId: parentTeleDriveFolderId,
              name: folderItem.name,
            },
          });
        }

        googleFolderIdToTeleDriveFolderId.set(folderItem.googleFileId, teleFolder.id);

        await db.googleMigrationItem.update({
          where: { id: folderItem.id },
          data: {
            status: 'COMPLETED',
            teledriveFolderId: teleFolder.id,
          },
        });
      }

      pendingFolders = nextPending;
    }

    // Any orphaned folders default to root backup folder
    for (const remainingFolder of pendingFolders) {
      const teleFolder = await prisma.folder.create({
        data: {
          userId,
          parentFolderId: migration.backupFolderId,
          name: remainingFolder.name,
        },
      });
      googleFolderIdToTeleDriveFolderId.set(remainingFolder.googleFileId, teleFolder.id);
      await db.googleMigrationItem.update({
        where: { id: remainingFolder.id },
        data: {
          status: 'COMPLETED',
          teledriveFolderId: teleFolder.id,
        },
      });
    }

    const createdFoldersCount = folderItems.length;
    await db.googleMigration.update({
      where: { id: migrationId },
      data: { foldersMigrated: createdFoldersCount },
    });

    // STEP 2: Copy Files (Active files only)
    const fileItems = migration.items.filter((item: any) => !item.isFolder && item.status !== 'SKIPPED');
    let filesMigratedCount = migration.filesMigrated;
    let bytesTransferredCount = BigInt(migration.bytesTransferred);
    let failedCount = migration.failedCount;
    let skippedCount = migration.skippedCount;

    const startTime = Date.now();

    for (let i = 0; i < fileItems.length; i++) {
      if (await isCancelled()) return;

      const item = fileItems[i];

      // Skip already completed, verified, or skipped items
      if (item.status === 'COMPLETED' || item.status === 'VERIFIED' || item.status === 'SKIPPED') {
        continue;
      }

      try {
        await db.googleMigrationItem.update({
          where: { id: item.id },
          data: { status: 'DOWNLOADING' },
        });

        const elapsedTimeSec = (Date.now() - startTime) / 1000 || 1;
        const currentSpeedBytesPerSec = Number(bytesTransferredCount) / elapsedTimeSec;
        const remainingBytes = Number(migration.totalBytesDiscovered - bytesTransferredCount);
        const estimatedRemainingSec = currentSpeedBytesPerSec > 0 ? Math.ceil(remainingBytes / currentSpeedBytesPerSec) : 0;

        await db.googleMigration.update({
          where: { id: migrationId },
          data: {
            currentFileName: item.name,
            currentFileStatus: 'Downloading from Google Drive...',
            transferSpeed: currentSpeedBytesPerSec,
            estimatedRemainingSeconds: estimatedRemainingSec,
          },
        });

        // Determine destination TeleDrive folder
        let destinationFolderId = migration.backupFolderId;
        if (item.googleParentId && googleFolderIdToTeleDriveFolderId.has(item.googleParentId)) {
          destinationFolderId = googleFolderIdToTeleDriveFolderId.get(item.googleParentId)!;
        }

        let fileBuffer: Buffer;
        let finalMimeType = item.mimeType;
        let finalFileName = item.name;
        let finalExtension = item.name.includes('.') ? item.name.split('.').pop()! : 'bin';

        if (item.isWorkspaceFile) {
          if (!item.exportMimeType) {
            // Unsupported Google Workspace format
            await db.googleMigrationItem.update({
              where: { id: item.id },
              data: { status: 'SKIPPED', errorReason: 'Unsupported Google Workspace File Type' },
            });
            skippedCount++;
            continue;
          }

          const exportRes = await drive.files.export(
            { fileId: item.googleFileId, mimeType: item.exportMimeType },
            { responseType: 'arraybuffer' }
          );
          fileBuffer = Buffer.from(exportRes.data as ArrayBuffer);
          finalMimeType = item.exportMimeType;
          if (item.exportExtension && !finalFileName.endsWith(`.${item.exportExtension}`)) {
            finalFileName = `${item.name}.${item.exportExtension}`;
            finalExtension = item.exportExtension;
          }
        } else {
          const res = await drive.files.get(
            { fileId: item.googleFileId, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          fileBuffer = Buffer.from(res.data as ArrayBuffer);
        }

        await db.googleMigrationItem.update({
          where: { id: item.id },
          data: { status: 'UPLOADING' },
        });

        await db.googleMigration.update({
          where: { id: migrationId },
          data: { currentFileStatus: 'Storing to TeleDrive Cloud...' },
        });

        // Save to TeleDrive storage provider
        const uploadResult = await storageProvider.upload(fileBuffer, {
          filename: finalFileName,
          mimeType: finalMimeType,
          size: fileBuffer.length,
          userId,
        });

        // Check if file already exists in THIS target destination folder for duplicate prevention
        let teleFile = await (prisma.file as any).findFirst({
          where: {
            userId,
            folderId: destinationFolderId,
            googleDriveFileId: item.googleFileId,
          },
        });

        if (!teleFile) {
          teleFile = await (prisma.file as any).create({
            data: {
              userId,
              folderId: destinationFolderId,
              name: finalFileName,
              originalName: item.name,
              mimeType: finalMimeType,
              extension: finalExtension,
              size: BigInt(fileBuffer.length),
              hash: uploadResult.hash || '',
              storageProvider: uploadResult.provider,
              storageObjectId: uploadResult.objectId,
              telegramFileId: uploadResult.providerSpecific?.telegramFileId || null,
              telegramMessageId: uploadResult.providerSpecific?.telegramMessageId || null,
              telegramChatId: uploadResult.providerSpecific?.telegramChatId || null,
              isGoogleDriveBackup: true,
              googleDriveFileId: item.googleFileId,
              googleDriveSourcePath: `${migration.backupFolderName}/${item.name}`,
            },
          });
        }

        filesMigratedCount++;
        bytesTransferredCount += BigInt(fileBuffer.length);

        await db.googleMigrationItem.update({
          where: { id: item.id },
          data: {
            status: 'COMPLETED',
            teledriveFileId: teleFile.id,
            size: BigInt(fileBuffer.length),
          },
        });

        await db.googleMigration.update({
          where: { id: migrationId },
          data: {
            filesMigrated: filesMigratedCount,
            bytesTransferred: bytesTransferredCount,
          },
        });
      } catch (fileErr: any) {
        console.error(`Failed to migrate Google Drive file ${item.name}:`, fileErr);
        failedCount++;

        await db.googleMigrationItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            errorReason: fileErr.message || 'Download/Upload Network Error',
          },
        });

        await db.googleMigration.update({
          where: { id: migrationId },
          data: { failedCount },
        });
      }
    }

    // STEP 3: Verification Phase
    await this.verifyMigration(userId, migrationId);
  }

  /**
   * Verifies source vs destination items 100%
   */
  static async verifyMigration(userId: string, migrationId: string) {
    await db.googleMigration.update({
      where: { id: migrationId },
      data: { status: 'VERIFYING' },
    });

    const items = await db.googleMigrationItem.findMany({
      where: { migrationId },
    });

    let verifiedCount = 0;

    for (const item of items) {
      if (item.isFolder) {
        if (item.teledriveFolderId) {
          const folderExists = await prisma.folder.findFirst({
            where: { id: item.teledriveFolderId, userId },
          });
          if (folderExists) {
            verifiedCount++;
            await db.googleMigrationItem.update({
              where: { id: item.id },
              data: { status: 'VERIFIED' },
            });
          }
        }
      } else if (item.status === 'COMPLETED' && item.teledriveFileId) {
        const fileRecord = await prisma.file.findFirst({
          where: { id: item.teledriveFileId, userId },
        });

        if (fileRecord && fileRecord.size > BigInt(0)) {
          verifiedCount++;
          await db.googleMigrationItem.update({
            where: { id: item.id },
            data: { status: 'VERIFIED' },
          });
        } else {
          await db.googleMigrationItem.update({
            where: { id: item.id },
            data: { status: 'FAILED', errorReason: 'Destination verification check failed' },
          });
        }
      }
    }

    const migration = await db.googleMigration.findUnique({ where: { id: migrationId } });
    const finalStatus = (migration?.failedCount || 0) > 0 ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED';

    await db.googleMigration.update({
      where: { id: migrationId },
      data: {
        status: finalStatus,
        filesVerified: verifiedCount,
        completedAt: new Date(),
        currentFileName: null,
        currentFileStatus: null,
      },
    });
  }

  /**
   * 2-Step Confirmed Safe Deletion of Verified Google Drive Items
   */
  static async confirmAndDeleteVerifiedItems(userId: string, migrationId: string, confirmationPhrase: string) {
    if (confirmationPhrase !== 'DELETE MY GOOGLE DRIVE') {
      throw new Error('Invalid confirmation phrase. Type DELETE MY GOOGLE DRIVE to confirm.');
    }

    const migration = await db.googleMigration.findFirst({
      where: { id: migrationId, userId },
    });

    if (!migration) {
      throw new Error('Migration not found');
    }

    if (!migration.deleteOriginals) {
      throw new Error('Deletion option was not enabled during migration.');
    }

    const { oauth2Client } = await GoogleAuthService.getAuthenticatedClient(userId);
    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    // Select ONLY verified items that exist in TeleDrive
    const verifiedItems = await db.googleMigrationItem.findMany({
      where: {
        migrationId,
        status: 'VERIFIED',
        deletedFromGoogle: false,
      },
    });

    let deletedCount = 0;

    for (const item of verifiedItems) {
      try {
        await drive.files.delete({ fileId: item.googleFileId });

        await db.googleMigrationItem.update({
          where: { id: item.id },
          data: { deletedFromGoogle: true },
        });

        deletedCount++;
      } catch (err: any) {
        console.error(`Failed to delete file ${item.name} from Google Drive:`, err);
        await db.googleMigrationItem.update({
          where: { id: item.id },
          data: { deleteError: err.message || 'Google API Delete Error' },
        });
      }
    }

    await db.googleMigration.update({
      where: { id: migrationId },
      data: {
        deleteConfirmed: true,
        deletedFromGoogleCount: deletedCount,
      },
    });

    return {
      migrationId,
      deletedCount,
      totalVerified: verifiedItems.length,
    };
  }

  /**
   * Returns current status of a migration job
   */
  static async getMigrationStatus(userId: string, migrationId: string) {
    const migration = await db.googleMigration.findFirst({
      where: { id: migrationId, userId },
      include: { items: true },
    });

    if (!migration) {
      throw new Error('Migration not found');
    }

    const activeFiles = (migration.items || []).filter((i: any) => !i.isFolder && i.status !== 'SKIPPED');
    const activeFolders = (migration.items || []).filter((i: any) => i.isFolder && i.status !== 'SKIPPED');

    const totalActiveCount = activeFiles.length > 0 ? activeFiles.length : migration.totalFilesDiscovered;
    const totalActiveFolders = migration.items && migration.items.length > 0 ? activeFolders.length : migration.totalFoldersDiscovered;

    const totalActiveBytes = activeFiles.reduce((acc: bigint, i: any) => acc + BigInt(i.size || 0), BigInt(0));
    const displayBytes = totalActiveBytes > BigInt(0) ? totalActiveBytes : migration.totalBytesDiscovered;

    const percentage =
      totalActiveCount > 0
        ? Math.min(100, Math.round((migration.filesMigrated / totalActiveCount) * 100))
        : 100;

    return {
      ...migration,
      totalFilesDiscovered: totalActiveCount,
      totalFoldersDiscovered: totalActiveFolders,
      totalBytesDiscovered: displayBytes.toString(),
      bytesTransferred: migration.bytesTransferred.toString(),
      totalGoogleDriveBytes: migration.totalGoogleDriveBytes.toString(),
      usedGoogleDriveBytes: migration.usedGoogleDriveBytes.toString(),
      percentage,
    };
  }

  /**
   * Returns detailed report of a migration job
   */
  static async getMigrationReport(userId: string, migrationId: string) {
    const migration = await db.googleMigration.findFirst({
      where: { id: migrationId, userId },
      include: {
        items: true,
      },
    });

    if (!migration) {
      throw new Error('Migration not found');
    }

    const failedItems = migration.items.filter((item: any) => item.status === 'FAILED');
    const skippedItems = migration.items.filter((item: any) => item.status === 'SKIPPED');

    return {
      id: migration.id,
      backupFolderName: migration.backupFolderName,
      status: migration.status,
      deleteOriginals: migration.deleteOriginals,
      deleteConfirmed: migration.deleteConfirmed,
      totalFilesDiscovered: migration.totalFilesDiscovered,
      totalFoldersDiscovered: migration.totalFoldersDiscovered,
      totalBytesDiscovered: migration.totalBytesDiscovered.toString(),
      filesMigrated: migration.filesMigrated,
      foldersMigrated: migration.foldersMigrated,
      bytesTransferred: migration.bytesTransferred.toString(),
      filesVerified: migration.filesVerified,
      failedCount: migration.failedCount,
      skippedCount: migration.skippedCount,
      deletedFromGoogleCount: migration.deletedFromGoogleCount,
      startedAt: migration.startedAt,
      completedAt: migration.completedAt,
      failedItems: failedItems.map((f: any) => ({
        id: f.id,
        googleFileId: f.googleFileId,
        name: f.name,
        mimeType: f.mimeType,
        errorReason: f.errorReason,
      })),
      skippedItems: skippedItems.map((s: any) => ({
        id: s.id,
        googleFileId: s.googleFileId,
        name: s.name,
        reason: s.errorReason,
      })),
    };
  }

  /**
   * Returns audit CSV report text for downloading
   */
  static async downloadReportCSV(userId: string, migrationId: string): Promise<string> {
    const report = await this.getMigrationReport(userId, migrationId);
    let csv = `Google Drive Backup Report - ${report.backupFolderName}\n`;
    csv += `Date,${report.completedAt || new Date().toISOString()}\n`;
    csv += `Status,${report.status}\n`;
    csv += `Files Discovered,${report.totalFilesDiscovered}\n`;
    csv += `Files Migrated,${report.filesMigrated}\n`;
    csv += `Files Verified,${report.filesVerified}\n`;
    csv += `Failed Files,${report.failedCount}\n`;
    csv += `Skipped Files,${report.skippedCount}\n`;
    csv += `Google Originals Deleted,${report.deletedFromGoogleCount}\n\n`;

    csv += `File Name,Google File ID,Status,Error/Reason\n`;
    const items = await db.googleMigrationItem.findMany({ where: { migrationId } });
    for (const item of items) {
      csv += `"${item.name.replace(/"/g, '""')}",${item.googleFileId},${item.status},"${(item.errorReason || item.deleteError || '').replace(/"/g, '""')}"\n`;
    }

    return csv;
  }

  /**
   * Gets list of past migration runs
   */
  static async getMigrationHistory(userId: string) {
    const list = await db.googleMigration.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((m: any) => ({
      id: m.id,
      backupFolderName: m.backupFolderName,
      status: m.status,
      filesMigrated: m.filesMigrated,
      totalFiles: m.totalFilesDiscovered,
      totalBytes: m.totalBytesDiscovered.toString(),
      deleteOriginals: m.deleteOriginals,
      deleteConfirmed: m.deleteConfirmed,
      completedAt: m.completedAt || m.createdAt,
    }));
  }
}
