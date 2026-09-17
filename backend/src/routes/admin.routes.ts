import { Router, Response } from 'express';
import { prisma } from '../config/db.js';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middlewares/auth.middleware.js';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(requireAdmin);

// GET /api/admin/stats - System health & statistics
router.get('/stats', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalFiles = await prisma.file.count({ where: { isTrashed: false } });
    const totalFolders = await prisma.folder.count({ where: { isTrashed: false } });
    
    const sizeAggregate = await prisma.file.aggregate({
      _sum: { size: true },
      where: { isTrashed: false },
    });
    
    const activeSessions = await prisma.session.count({
      where: { expiresAt: { gte: new Date() } },
    });

    const recentUsers = await prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        role: true,
        createdAt: true,
      },
    });

    res.json({
      totalUsers,
      totalFiles,
      totalFolders,
      totalStorageBytes: Number(sizeAggregate._sum.size || 0),
      activeSessions,
      recentUsers,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/users - List all users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        role: true,
        isProfileComplete: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            files: true,
            folders: true,
          },
        },
      },
    });

    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/admin/users/:id/role - Promote/Demote user role
router.put('/users/:id/role', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['USER', 'ADMIN'].includes(role)) {
      res.status(400).json({ error: 'Role must be either USER or ADMIN' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: String(id) },
      data: { role },
      select: {
        id: true,
        displayName: true,
        email: true,
        phoneNumber: true,
        role: true,
      },
    });

    res.json({ user: updatedUser, message: `User role updated to ${role}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
