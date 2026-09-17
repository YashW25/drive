import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    phoneNumber: string;
    displayName: string;
    role: string;
    avatarUrl?: string | null;
  };
}

export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    let token = req.headers.authorization?.replace('Bearer ', '');

    if (!token && req.cookies?.teledrive_session) {
      token = req.cookies.teledrive_session;
    }

    if (!token && req.query?.token) {
      token = req.query.token as string;
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await AuthService.verifyToken(token);
    req.user = user;
    next();
  } catch (error: any) {
    res.status(401).json({ error: error.message || 'Invalid session' });
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    return;
  }
  next();
}
