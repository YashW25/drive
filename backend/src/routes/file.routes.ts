import { Router, Response } from 'express';
import multer from 'multer';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { FileService } from '../services/file.service.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB upload limit
});

const router = Router();

// POST /api/files/upload
router.post(
  '/upload',
  authenticate,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      const userId = req.user!.id;
      const folderId = (req.body.folderId as string) || null;
      const allowDuplicate = req.body.allowDuplicate === 'true' || req.body.allowDuplicate === true;

      const result = await FileService.uploadFile(
        userId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
        folderId,
        allowDuplicate
      );

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/files/:id/version
router.post(
  '/:id/version',
  authenticate,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file version provided' });
        return;
      }
      const userId = req.user!.id;
      const fileId = req.params.id as string;
      const result = await FileService.uploadNewVersion(
        userId,
        fileId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /api/files/:id
router.get('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id as string;
    const file = await FileService.getFileDetails(userId, fileId);
    res.json(file);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// GET /api/files/:id/download
router.get('/:id/download', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id as string;
    const { stream, filename, mimeType, size } = await FileService.getDownloadStream(userId, fileId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', size.toString());

    stream.pipe(res);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/files/:id/raw (Stream for inline audio/video/image preview)
router.get('/:id/raw', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.id as string;
    const { stream, filename, mimeType, size } = await FileService.getDownloadStream(userId, fileId);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', size.toString());

    stream.pipe(res);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Views: Starred, Recent, Trash, Storage Dashboard
router.get('/view/starred', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const data = await FileService.getStarred(req.user!.id);
  res.json(data);
});

router.get('/view/recent', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const data = await FileService.getRecent(req.user!.id);
  res.json(data);
});

router.get('/view/trash', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const data = await FileService.getTrash(req.user!.id);
  res.json(data);
});

router.post('/view/trash/empty', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  await FileService.emptyTrash(req.user!.id);
  res.json({ success: true, message: 'Trash emptied successfully' });
});

router.post('/view/drive/empty', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await FileService.emptyDrive(req.user!.id);
    res.json({ success: true, message: 'Drive emptied successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});


router.get('/view/storage', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const data = await FileService.getStorageDashboard(req.user!.id);
  res.json(data);
});

// PATCH /api/files/:id/rename
router.patch('/:id/rename', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    const file = await FileService.renameFile(req.user!.id, fileId, req.body.name);
    res.json(file);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/files/:id/move
router.patch('/:id/move', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    const file = await FileService.moveFile(req.user!.id, fileId, req.body.targetFolderId);
    res.json(file);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:id/copy
router.post('/:id/copy', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    const file = await FileService.makeCopy(req.user!.id, fileId);
    res.json(file);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /api/files/:id/star
router.patch('/:id/star', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    const file = await FileService.toggleStarFile(req.user!.id, fileId);
    res.json(file);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/files/:id (Trash)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    await FileService.trashFile(req.user!.id, fileId);
    res.json({ success: true, message: 'File moved to trash' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/files/:id/restore
router.post('/:id/restore', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    await FileService.restoreFile(req.user!.id, fileId);
    res.json({ success: true, message: 'File restored from trash' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/files/:id/permanent
router.delete('/:id/permanent', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const fileId = req.params.id as string;
    await FileService.deleteFilePermanently(req.user!.id, fileId);
    res.json({ success: true, message: 'File deleted permanently' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
