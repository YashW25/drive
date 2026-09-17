import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { AIService } from '../services/ai.service.js';

const router = Router();

// POST /api/ai/ask
router.post('/ask', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { query, fileIds } = req.body;
    const answer = await AIService.askFiles(userId, query, fileIds);
    res.json(answer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
