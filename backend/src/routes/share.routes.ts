import { Router, Request, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { ShareService } from '../services/share.service.js';

const router = Router();

// POST /api/share (Authenticated)
router.post('/', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const result = await ShareService.createShareLink(userId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/share/:token (Public)
router.get('/:token', async (req: Request, res: Response) => {
  try {
    const password = req.headers['x-share-password'] as string | undefined;
    const token = req.params.token as string;
    const item = await ShareService.getSharedItem(token, password);
    res.json(item);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/share/:token/download (Public stream)
router.get('/:token/download', async (req: Request, res: Response) => {
  try {
    const password = req.headers['x-share-password'] as string | undefined;
    const token = req.params.token as string;
    const { stream, filename, mimeType, size } = await ShareService.downloadSharedFile(
      token,
      password
    );

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Length', size.toString());

    stream.pipe(res);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/share/:id (Authenticated)
router.delete('/:id', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const shareId = req.params.id as string;
    await ShareService.revokeShareLink(userId, shareId);
    res.json({ success: true, message: 'Share link revoked.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
