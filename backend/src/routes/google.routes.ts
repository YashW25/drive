import { Router, Response } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { GoogleAuthService } from '../services/google.auth.service.js';
import { GoogleMigrationService } from '../services/google.migration.service.js';

const router = Router();

// GET /api/google/auth-url
router.get('/auth-url', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const state = req.user!.id;
    const url = GoogleAuthService.getAuthUrl(state);
    res.json({ url });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/google/callback
router.get('/callback', async (req: AuthenticatedRequest, res: Response) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (!code || !state) {
    res.redirect(`${frontendUrl}/drive?view=settings&error=missing_oauth_code`);
    return;
  }

  try {
    await GoogleAuthService.handleAuthCallback(code, state);
    res.redirect(`${frontendUrl}/drive?view=settings&google=connected`);
  } catch (err: any) {
    console.error('OAuth Callback Error:', err);
    res.redirect(`${frontendUrl}/drive?view=settings&error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/google/status
router.get('/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = await GoogleAuthService.getConnectionStatus(req.user!.id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google/disconnect
router.post('/disconnect', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    await GoogleAuthService.disconnect(req.user!.id);
    res.json({ success: true, message: 'Google Drive account disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google/scan
router.post('/scan', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const scanResult = await GoogleMigrationService.scanDrive(req.user!.id);
    res.json(scanResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google/migrations/start
router.post('/migrations/start', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { migrationId, customFolderName, deleteOriginals, selectedGoogleFileIds } = req.body;
    if (!migrationId) {
      res.status(400).json({ error: 'migrationId is required' });
      return;
    }

    const result = await GoogleMigrationService.startMigration(
      req.user!.id,
      migrationId,
      customFolderName,
      deleteOriginals,
      selectedGoogleFileIds
    );
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/google/migrations/:id/status
router.get('/migrations/:id/status', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const status = await GoogleMigrationService.getMigrationStatus(req.user!.id, id);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google/migrations/:id/resume
router.post('/migrations/:id/resume', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await GoogleMigrationService.resumeMigration(req.user!.id, id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google/migrations/:id/cancel
router.post('/migrations/:id/cancel', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const result = await GoogleMigrationService.cancelMigration(req.user!.id, id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/google/migrations/:id/report
router.get('/migrations/:id/report', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const report = await GoogleMigrationService.getMigrationReport(req.user!.id, id);
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/google/migrations/:id/report/download
router.get('/migrations/:id/report/download', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const csv = await GoogleMigrationService.downloadReportCSV(req.user!.id, id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=google_migration_report_${id}.csv`);
    res.send(csv);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/google/migrations/:id/confirm-delete
router.post('/migrations/:id/confirm-delete', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const { confirmationPhrase } = req.body;
    const result = await GoogleMigrationService.confirmAndDeleteVerifiedItems(
      req.user!.id,
      id,
      confirmationPhrase
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/google/migrations
router.get('/migrations', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const history = await GoogleMigrationService.getMigrationHistory(req.user!.id);
    res.json(history);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
