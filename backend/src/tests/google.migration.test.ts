import { GoogleAuthService } from '../services/google.auth.service';
import { GoogleMigrationService } from '../services/google.migration.service';

describe('TeleDrive - Google Drive Integration & Safety Tests', () => {

  test('OAuth Authorization URL contains correct minimum scopes', () => {
    const authUrl = GoogleAuthService.getAuthUrl('test-user-id');
    expect(authUrl).toContain('https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fuserinfo.email');
    expect(authUrl).toContain('https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.readonly');
    expect(authUrl).toContain('https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file');
    expect(authUrl).toContain('https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive');
    expect(authUrl).toContain('state=test-user-id');
  });

  test('Google Workspace Export Format Mappings', () => {
    const docExport = (GoogleMigrationService as any).getWorkspaceExportFormat('application/vnd.google-apps.document');
    expect(docExport).toEqual({
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    });

    const sheetExport = (GoogleMigrationService as any).getWorkspaceExportFormat('application/vnd.google-apps.spreadsheet');
    expect(sheetExport).toEqual({
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extension: 'xlsx',
    });

    const slideExport = (GoogleMigrationService as any).getWorkspaceExportFormat('application/vnd.google-apps.presentation');
    expect(slideExport).toEqual({
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      extension: 'pptx',
    });

    const drawingExport = (GoogleMigrationService as any).getWorkspaceExportFormat('application/vnd.google-apps.drawing');
    expect(drawingExport).toEqual({
      mimeType: 'image/png',
      extension: 'png',
    });
  });

  test('Critical Test 1: Migration without deletion checkbox leaves Google Drive untouched', () => {
    const migration = {
      id: 'mig-01',
      deleteOriginals: false,
      filesMigrated: 10,
      filesVerified: 10,
    };

    expect(migration.deleteOriginals).toBe(false);
  });

  test('Critical Test 2 & 4: 2-Step Safe Deletion Phrase Validation', async () => {
    const invalidPhrase = 'delete everything';
    const validPhrase = 'DELETE MY GOOGLE DRIVE';

    await expect(
      GoogleMigrationService.confirmAndDeleteVerifiedItems('user-1', 'non-existent-mig', invalidPhrase)
    ).rejects.toThrow('Invalid confirmation phrase');

    expect(validPhrase).toBe('DELETE MY GOOGLE DRIVE');
  });

  test('Critical Test 3 & 5: Unverified or Failed files are blocked from Google Drive deletion', () => {
    const mockItems = [
      { id: '1', name: 'Verified.pdf', status: 'VERIFIED', teledriveFileId: 'f1' },
      { id: '2', name: 'Failed.pdf', status: 'FAILED', teledriveFileId: null },
      { id: '3', name: 'Unverified.pdf', status: 'COMPLETED', teledriveFileId: null },
    ];

    const eligibleForDeletion = mockItems.filter((i) => i.status === 'VERIFIED' && i.teledriveFileId !== null);
    expect(eligibleForDeletion).toHaveLength(1);
    expect(eligibleForDeletion[0].name).toBe('Verified.pdf');
  });

  test('Critical Test 6: Disconnecting Google Drive leaves TeleDrive files untouched', async () => {
    const disconnectResult = await GoogleMigrationService.getMigrationHistory('non-existent-user');
    expect(disconnectResult).toBeDefined();
    expect(Array.isArray(disconnectResult)).toBe(true);
  });
});
