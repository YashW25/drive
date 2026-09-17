import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const router = Router();

// POST /api/auth/otp/request
router.post('/otp/request', async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }
    const result = await AuthService.requestOtp(phoneNumber);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/otp/verify
router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { phoneNumber, code } = req.body;
    if (!phoneNumber || !code) {
      res.status(400).json({ error: 'Phone number and verification code are required' });
      return;
    }
    const result = await AuthService.verifyOtp(
      phoneNumber,
      code,
      req.ip,
      req.headers['user-agent']
    );

    // Set secure HTTP-only cookie
    res.cookie('teledrive_session', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.teledrive_session;
  if (token) {
    await AuthService.logout(token);
  }
  res.clearCookie('teledrive_session');
  res.json({ message: 'Logged out successfully' });
});

export default router;
