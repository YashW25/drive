import { prisma } from '../config/db.js';

export class FolderService {
  static async createFolder(userId: string, name: string, parentFolderId?: string | null) {
    const trimmedName = name.trim();
    const targetParentId = parentFolderId || null;

    if (targetParentId) {
      const parent = await prisma.folder.findFirst({
        where: { id: targetParentId, userId },
      });
      if (!parent) {
        throw new Error('Parent folder not found or access denied.');
      }
    }

    // Deduplicate folder creation by name within the same parent folder
    const existingFolders = await prisma.folder.findMany({
      where: {
        userId,
        parentFolderId: targetParentId,
        isTrashed: false,
      },
    });

    const existing = existingFolders.find(
      (f) => f.name.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existing) {
      return existing;
    }

    return prisma.folder.create({
      data: {
        userId,
        name: trimmedName,
        parentFolderId: targetParentId,
      },
    });
  }

  static async getFolderContents(
    userId: string,
    folderId?: string | null,
    searchQuery?: string,
    sortField: string = 'name',
    sortOrder: 'asc' | 'desc' = 'asc'
  ) {
    const isRoot = !folderId || folderId === 'root';
    const targetParentId = isRoot ? null : folderId;

    const folderWhere: any = {
      userId,
      isTrashed: false,
    };
    if (!searchQuery) {
      folderWhere.parentFolderId = targetParentId;
    }

    const fileWhere: any = {
      userId,
      isTrashed: false,
      deletedAt: null,
    };
    if (!searchQuery) {
      fileWhere.folderId = targetParentId;
    }

    if (searchQuery) {
      folderWhere.name = { contains: searchQuery };
      fileWhere.name = { contains: searchQuery };
    }

    let folders = await prisma.folder.findMany({
      where: folderWhere,
      orderBy: { [sortField === 'size' ? 'name' : sortField]: sortOrder },
    });

    // Auto-merge duplicate folders with identical names in the same folder
    if (!searchQuery && folders.length > 1) {
      const folderMap = new Map<string, typeof folders[0]>();
      const duplicateIdsToRemove: string[] = [];

      for (const f of folders) {
        const key = f.name.toLowerCase();
        if (!folderMap.has(key)) {
          folderMap.set(key, f);
        } else {
          const primaryFolder = folderMap.get(key)!;
          // Move files from duplicate folder to primary folder
          await prisma.file.updateMany({
            where: { folderId: f.id },
            data: { folderId: primaryFolder.id },
          });
          // Move subfolders from duplicate folder to primary folder
          await prisma.folder.updateMany({
            where: { parentFolderId: f.id },
            data: { parentFolderId: primaryFolder.id },
          });
          duplicateIdsToRemove.push(f.id);
        }
      }

      if (duplicateIdsToRemove.length > 0) {
        await prisma.folder.deleteMany({
          where: { id: { in: duplicateIdsToRemove } },
        });
        // Refetch clean folders list
        folders = await prisma.folder.findMany({
          where: folderWhere,
          orderBy: { [sortField === 'size' ? 'name' : sortField]: sortOrder },
        });
      }
    }

    const files = await prisma.file.findMany({
      where: fileWhere,
      orderBy: { [sortField]: sortOrder },
      include: {
        previews: true,
      },
    });

    // Build breadcrumbs if inside a specific folder
    let breadcrumbs: Array<{ id: string | null; name: string }> = [
      { id: null, name: 'My Drive' },
    ];

    if (!isRoot && folderId) {
      let currentId: string | null = folderId;
      const stack: Array<{ id: string; name: string }> = [];

      while (currentId) {
        const f: { id: string; name: string; parentFolderId: string | null; userId: string } | null = await prisma.folder.findUnique({
          where: { id: currentId },
        });
        if (!f || f.userId !== userId) break;
        stack.unshift({ id: f.id, name: f.name });
        currentId = f.parentFolderId;
      }
      breadcrumbs = breadcrumbs.concat(stack);
    }

    return {
      currentFolderId: targetParentId,
      breadcrumbs,
      folders,
      files,
    };
  }

  static async renameFolder(userId: string, folderId: string, newName: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error('Folder not found');

    if (
      folder.name.toLowerCase() === 'camera' &&
      (folder.parentFolderId === null || folder.parentFolderId === undefined)
    ) {
      throw new Error('System Camera folder cannot be renamed.');
    }

    return prisma.folder.update({
      where: { id: folderId },
      data: { name: newName.trim() },
    });
  }

  static async moveFolder(userId: string, folderId: string, targetParentId: string | null) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error('Folder not found');

    if (targetParentId === folderId) {
      throw new Error('Cannot move a folder into itself.');
    }

    return prisma.folder.update({
      where: { id: folderId },
      data: { parentFolderId: targetParentId },
    });
  }

  static async toggleStarFolder(userId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error('Folder not found');

    const newStarred = !folder.isStarred;
    return prisma.folder.update({
      where: { id: folderId },
      data: { isStarred: newStarred },
    });
  }

  static async trashFolder(userId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error('Folder not found');

    const now = new Date();

    const collectSubFolderIds = async (parentIds: string[]): Promise<string[]> => {
      if (parentIds.length === 0) return [];
      const children = await prisma.folder.findMany({
        where: { parentFolderId: { in: parentIds }, userId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) return parentIds;
      const deeperIds = await collectSubFolderIds(childIds);
      return [...parentIds, ...deeperIds];
    };

    const allFolderIds = await collectSubFolderIds([folderId]);

    // Mark all collected folders as trashed
    await prisma.folder.updateMany({
      where: { id: { in: allFolderIds }, userId },
      data: { isTrashed: true, trashedAt: now },
    });

    // Mark all files inside any of these folders as trashed
    await prisma.file.updateMany({
      where: { folderId: { in: allFolderIds }, userId },
      data: { isTrashed: true, trashedAt: now, deletedAt: now },
    });

    await prisma.trashItem.upsert({
      where: {
        userId_itemType_itemId: {
          userId,
          itemType: 'FOLDER',
          itemId: folderId,
        },
      },
      create: {
        userId,
        itemType: 'FOLDER',
        itemId: folderId,
        deletedAt: now,
        autoDeleteAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        deletedAt: now,
      },
    });

    return true;
  }

  static async restoreFolder(userId: string, folderId: string) {
    const collectSubFolderIds = async (parentIds: string[]): Promise<string[]> => {
      if (parentIds.length === 0) return [];
      const children = await prisma.folder.findMany({
        where: { parentFolderId: { in: parentIds }, userId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) return parentIds;
      const deeperIds = await collectSubFolderIds(childIds);
      return [...parentIds, ...deeperIds];
    };

    const allFolderIds = await collectSubFolderIds([folderId]);

    await prisma.folder.updateMany({
      where: { id: { in: allFolderIds }, userId },
      data: { isTrashed: false, trashedAt: null },
    });

    await prisma.file.updateMany({
      where: { folderId: { in: allFolderIds }, userId },
      data: { isTrashed: false, trashedAt: null, deletedAt: null },
    });

    await prisma.trashItem.deleteMany({
      where: { userId, itemType: 'FOLDER', itemId: folderId },
    });

    return true;
  }

  static async deleteFolderPermanently(userId: string, folderId: string) {
    const folder = await prisma.folder.findFirst({
      where: { id: folderId, userId },
    });
    if (!folder) throw new Error('Folder not found');

    const collectSubFolderIds = async (parentIds: string[]): Promise<string[]> => {
      if (parentIds.length === 0) return [];
      const children = await prisma.folder.findMany({
        where: { parentFolderId: { in: parentIds }, userId },
        select: { id: true },
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) return parentIds;
      const deeperIds = await collectSubFolderIds(childIds);
      return [...parentIds, ...deeperIds];
    };

    const allFolderIds = await collectSubFolderIds([folderId]);

    // Delete all files inside these folders
    await prisma.file.deleteMany({
      where: { folderId: { in: allFolderIds }, userId },
    });

    // Delete all subfolders
    for (const id of [...allFolderIds].reverse()) {
      await prisma.folder.deleteMany({
        where: { id, userId },
      });
    }

    await prisma.trashItem.deleteMany({
      where: { userId, itemType: 'FOLDER', itemId: folderId },
    });

    return true;
  }
}
