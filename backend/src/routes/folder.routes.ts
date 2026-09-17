import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { FolderService } from '../services/folder.service.js';

const router = Router();

// GET /api/folders?folderId=...&q=...&sort=...&order=...
router.get('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = (req.query.folderId as string) || null;
    const q = req.query.q as string;
    const sort = (req.query.sort as string) || 'name';
    const order = ((req.query.order as string) === 'desc' ? 'desc' : 'asc') as 'asc' | 'desc';

    const result = await FolderService.getFolderContents(userId, folderId, q, sort, order);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/folders
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, parentFolderId } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }
    const folder = await FolderService.createFolder(userId, name, parentFolderId);
    res.status(201).json(folder);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/folders/:id/rename
router.patch('/:id/rename', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id as string;
    const { name } = req.body;
    const folder = await FolderService.renameFolder(userId, folderId, name);
    res.json(folder);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/folders/:id/move
router.patch('/:id/move', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id as string;
    const { targetParentId } = req.body;
    const folder = await FolderService.moveFolder(userId, folderId, targetParentId);
    res.json(folder);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/folders/:id/star
router.patch('/:id/star', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id as string;
    const folder = await FolderService.toggleStarFolder(userId, folderId);
    res.json(folder);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/folders/:id (Trash)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id as string;
    await FolderService.trashFolder(userId, folderId);
    res.json({ success: true, message: 'Folder moved to trash' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/folders/:id/restore
router.post('/:id/restore', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id as string;
    await FolderService.restoreFolder(userId, folderId);
    res.json({ success: true, message: 'Folder restored from trash' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/folders/:id/permanent
router.delete('/:id/permanent', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const folderId = req.params.id as string;
    await FolderService.deleteFolderPermanently(userId, folderId);
    res.json({ success: true, message: 'Folder deleted permanently' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
