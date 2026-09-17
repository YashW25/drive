import React, { useState, useEffect } from 'react';
import {
  X,
  CloudDownload,
  FolderPlus,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
  RefreshCw,
  Download,
  Trash2,
  HardDrive,
  ShieldCheck,
  Pause,
  Play,
  ExternalLink,
  XCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api';

interface ScanResult {
  migrationId: string;
  accountEmail: string;
  backupFolderName: string;
  totalFiles: number;
  totalFolders: number;
  totalBytes: string;
  totalGoogleDriveBytes?: string;
  usedGoogleDriveBytes?: string;
  unsupportedCount: number;
  items?: Array<{
    id: string;
    googleFileId: string;
    googleParentId: string | null;
    name: string;
    mimeType: string;
    isFolder: boolean;
    isWorkspaceFile: boolean;
    size: string;
  }>;
}

interface MigrationStatus {
  id: string;
  backupFolderName: string;
  backupFolderId?: string;
  status: string;
  deleteOriginals: boolean;
  deleteConfirmed: boolean;
  totalFilesDiscovered: number;
  totalFoldersDiscovered: number;
  totalBytesDiscovered: string;
  filesMigrated: number;
  foldersMigrated: number;
  bytesTransferred: string;
  filesVerified: number;
  failedCount: number;
  skippedCount: number;
  currentFileName: string | null;
  currentFileStatus: string | null;
  transferSpeed: number;
  estimatedRemainingSeconds: number;
  percentage: number;
}

interface GoogleMigrationWizardModalProps {
  scanResult: ScanResult;
  onClose: () => void;
  onOpenFolder?: (folderId: string) => void;
  onRequestDeleteConfirmation?: (migrationId: string, backupName: string, verifiedCount: number) => void;
}

export const GoogleMigrationWizardModal: React.FC<GoogleMigrationWizardModalProps> = ({
  scanResult,
  onClose,
  onOpenFolder,
  onRequestDeleteConfirmation,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Scan & Name, 2: Options, 3: Progress, 4: Report
  const [backupFolderName, setBackupFolderName] = useState(scanResult.backupFolderName);
  const [deleteOriginals, setDeleteOriginals] = useState(false);
  const [migrationId, setMigrationId] = useState(scanResult.migrationId);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFailedItems, setShowFailedItems] = useState(false);
  const [reportDetails, setReportDetails] = useState<any | null>(null);

  const [importMode, setImportMode] = useState<'all' | 'selective'>('all');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    (scanResult.items || []).forEach((item: any) => set.add(item.googleFileId));
    return set;
  });
  const [itemSearch, setItemSearch] = useState('');

  const filteredDiscoveredItems = (scanResult.items || []).filter((item: any) =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase())
  );

  const toggleItemSelection = (googleFileId: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(googleFileId)) {
      next.delete(googleFileId);
    } else {
      next.add(googleFileId);
    }
    setSelectedItemIds(next);
  };

  const toggleSelectAllItems = () => {
    const allCount = scanResult.items?.length || 0;
    if (selectedItemIds.size === allCount) {
      setSelectedItemIds(new Set());
    } else {
      const next = new Set<string>();
      (scanResult.items || []).forEach((item: any) => next.add(item.googleFileId));
      setSelectedItemIds(next);
    }
  };

  const formatSize = (bytesStr: string | number) => {
    const bytes = typeof bytesStr === 'string' ? parseInt(bytesStr, 10) : bytesStr;
    if (isNaN(bytes) || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return 'Calculating...';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // Poll migration status when in Step 3 (Progress)
  useEffect(() => {
    if (step !== 3 || !migrationId) return;

    let intervalId: any = null;

    const fetchStatus = async () => {
      try {
        const res = await apiRequest<MigrationStatus>(`/google/migrations/${migrationId}/status`);
        setStatus(res);

        if (res.status === 'COMPLETED' || res.status === 'COMPLETED_WITH_ERRORS' || res.status === 'FAILED' || res.status === 'CANCELLED') {
          // Move to completion report
          setStep(4);
          fetchReport();
        }
      } catch (err: any) {
        console.error('Migration polling error:', err);
      }
    };

    fetchStatus();
    intervalId = setInterval(fetchStatus, 1500);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [step, migrationId]);

  const fetchReport = async () => {
    try {
      const rep = await apiRequest(`/google/migrations/${migrationId}/report`);
      setReportDetails(rep);
    } catch (err) {
      console.error('Failed to fetch report:', err);
    }
  };

  const handleCancelMigration = async () => {
    try {
      setLoading(true);
      await apiRequest(`/google/migrations/${migrationId}/cancel`, { method: 'POST' });
      setLoading(false);
      const res = await apiRequest<MigrationStatus>(`/google/migrations/${migrationId}/status`);
      setStatus(res);
      setStep(4);
      fetchReport();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to cancel migration');
    }
  };

  const handleStartMigration = async () => {
    try {
      setLoading(true);
      setError(null);

      const selectedIds = importMode === 'selective' ? Array.from(selectedItemIds) : undefined;

      await apiRequest('/google/migrations/start', {
        method: 'POST',
        body: JSON.stringify({
          migrationId,
          customFolderName: backupFolderName,
          deleteOriginals,
          selectedGoogleFileIds: selectedIds,
        }),
      });

      setLoading(false);
      setStep(3);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to start migration');
    }
  };

  const handleResumeMigration = async () => {
    try {
      setLoading(true);
      await apiRequest(`/google/migrations/${migrationId}/resume`, { method: 'POST' });
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to resume migration');
    }
  };

  const handleDownloadReport = () => {
    const token = localStorage.getItem('teledrive_token');
    const downloadUrl = `/api/google/migrations/${migrationId}/report/download?token=${token}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `google_migration_report_${backupFolderName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-fade-in">
      <div className="w-full max-w-[95vw] sm:max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 relative animate-pop-in flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3.5 sm:pb-4 mb-4 sm:mb-5">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gradient-to-tr from-brand-600 to-indigo-500 rounded-xl text-white shadow-md flex-shrink-0">
              <CloudDownload className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-100 font-heading truncate">Google Drive Import & Backup</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">Connected to {scanResult.accountEmail}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Content */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5">
          {/* STEP 1: Scan Summary & Backup Name */}
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              {/* Google Drive Storage Banner */}
              {scanResult.usedGoogleDriveBytes && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
                      <HardDrive className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">Google Drive Account Storage</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <span className="text-brand-300 font-semibold">{formatSize(scanResult.usedGoogleDriveBytes)}</span> used
                        {scanResult.totalGoogleDriveBytes && scanResult.totalGoogleDriveBytes !== '0' && (
                          <span> of {formatSize(scanResult.totalGoogleDriveBytes)} total capacity</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg text-[11px] font-semibold text-blue-300">
                    Live Quota Verified
                  </span>
                </div>
              )}

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-3">
                  Google Drive Scan Summary
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <p className="text-lg font-bold text-slate-100">{scanResult.totalFiles.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Files Discovered</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <p className="text-lg font-bold text-slate-100">{scanResult.totalFolders.toLocaleString()}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Folders Found</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <p className="text-lg font-bold text-brand-400">{formatSize(scanResult.totalBytes)}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Import Content Size</p>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl">
                    <p className="text-lg font-bold text-amber-400">{scanResult.unsupportedCount}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Restricted Items</p>
                  </div>
                </div>
              </div>

              {/* Destination Folder Customization */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Target Backup Folder Name in TeleDrive:
                </label>
                <div className="relative">
                  <FolderPlus className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={backupFolderName}
                    onChange={(e) => setBackupFolderName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 focus:border-brand-500/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-100 font-medium focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400">
                  All Google Drive folders and subfolders will be recursively recreated inside this backup directory.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2: Migration Options & Item Selection */}
          {step === 2 && (
            <div className="space-y-5 animate-fade-in">
              {/* Import Mode Radio Options */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                  Select Import Scope:
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'all'}
                      onChange={() => setImportMode('all')}
                      className="text-brand-500 bg-slate-950 border-slate-700 focus:ring-brand-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-100">Import Complete Google Drive</span>
                      <p className="text-[11px] text-slate-400">Copy all discovered files, folders, and subdirectories</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'selective'}
                      onChange={() => setImportMode('selective')}
                      className="text-brand-500 bg-slate-950 border-slate-700 focus:ring-brand-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-100">Selective Item / Folder Import</span>
                      <p className="text-[11px] text-slate-400">Choose specific files or folders to migrate to TeleDrive</p>
                    </div>
                  </label>
                </div>

                {/* Selective Items List with Checkboxes */}
                {importMode === 'selective' && (
                  <div className="mt-4 pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        placeholder="Search items to import..."
                        className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-brand-500"
                      />
                      <button
                        onClick={toggleSelectAllItems}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium"
                      >
                        {selectedItemIds.size === (scanResult.items?.length || 0) ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-1 pr-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
                      {filteredDiscoveredItems.length === 0 ? (
                        <p className="text-[11px] text-slate-500 py-3 text-center">No matching items found.</p>
                      ) : (
                        filteredDiscoveredItems.map((item: any) => {
                          const isChecked = selectedItemIds.has(item.googleFileId);
                          return (
                            <label
                              key={item.id}
                              className="flex items-center gap-2.5 p-1.5 hover:bg-slate-900 rounded cursor-pointer text-xs text-slate-200 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleItemSelection(item.googleFileId)}
                                className="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-brand-500"
                              />
                              <span className="truncate flex-1 font-medium">{item.name}</span>
                              <span className="text-[10px] text-slate-500 uppercase font-mono">
                                {item.isFolder ? 'Folder' : formatSize(item.size)}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    <p className="text-[11px] text-brand-400">
                      Selected {selectedItemIds.size} of {scanResult.items?.length || scanResult.totalFiles} items for import.
                    </p>
                  </div>
                )}
              </div>

              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-semibold text-slate-200">Google Workspace Export Policy</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Native Google Workspace objects will be automatically exported to open format standards:
                  <br />
                  • Google Docs → <span className="text-brand-300 font-medium">.DOCX</span>
                  <br />
                  • Google Sheets → <span className="text-emerald-300 font-medium">.XLSX</span>
                  <br />
                  • Google Slides → <span className="text-amber-300 font-medium">.PPTX</span>
                  <br />• Google Drawings → <span className="text-sky-300 font-medium">.PNG</span>
                </p>
              </div>

              {/* Deletion Option Checkbox */}
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={deleteOriginals}
                    onChange={(e) => setDeleteOriginals(e.target.checked)}
                    className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500 focus:ring-offset-slate-900"
                  />
                  <div>
                    <span className="text-xs font-bold text-rose-300 flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-rose-400" />
                      Delete successfully migrated files from Google Drive
                    </span>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      If enabled, TeleDrive will delete only files and folders that have been successfully copied and 100% verified. Nothing will be deleted until the migration is complete and you provide final confirmation.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: Real-Time Progress UI */}
          {step === 3 && (
            <div className="space-y-6 animate-fade-in py-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 font-heading">Migrating Google Drive Content...</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Resumable Background Worker Active</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-brand-400 font-mono">
                    {status?.percentage || 0}%
                  </span>
                </div>
              </div>

              {/* Combined Progress Bar */}
              <div className="w-full h-3.5 bg-slate-950 border border-slate-800 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full bg-gradient-to-r from-brand-600 via-indigo-500 to-emerald-400 rounded-full transition-all duration-300 shadow-md shadow-brand-500/20"
                  style={{ width: `${status?.percentage || 0}%` }}
                />
              </div>

              {/* Progress Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Files Copying</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">
                    {(status?.filesMigrated || 0).toLocaleString()} / {(status?.totalFilesDiscovered || scanResult.totalFiles).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Folders Created</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">
                    {(status?.foldersMigrated || 0).toLocaleString()} / {(status?.totalFoldersDiscovered || scanResult.totalFolders).toLocaleString()}
                  </span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Data Transferred</span>
                  <span className="font-semibold text-brand-300 mt-0.5 block">
                    {formatSize(status?.bytesTransferred || 0)} / {formatSize(status?.totalBytesDiscovered || scanResult.totalBytes)}
                  </span>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                  <span className="text-slate-400 block text-[11px]">Est. Remaining</span>
                  <span className="font-semibold text-emerald-300 mt-0.5 block">
                    {formatTime(status?.estimatedRemainingSeconds || 0)}
                  </span>
                </div>
              </div>

              {/* Active File Banner */}
              {status?.currentFileName && (
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 truncate max-w-md">
                    <RefreshCw className="w-4 h-4 text-brand-400 animate-spin flex-shrink-0" />
                    <span className="text-slate-300 font-medium truncate">{status.currentFileName}</span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">{status.currentFileStatus}</span>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Final Migration Report Summary */}
          {step === 4 && (
            <div className="space-y-5 animate-fade-in">
              {status?.status === 'CANCELLED' ? (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300">
                  <AlertTriangle className="w-6 h-6 flex-shrink-0 text-amber-400" />
                  <div>
                    <h4 className="text-sm font-bold">Migration Cancelled by User</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Process halted. Items processed prior to cancellation were saved to <strong className="text-white">{backupFolderName}</strong>.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300">
                  <CheckCircle2 className="w-6 h-6 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold">Google Drive Migration Completed</h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Backup saved in folder <strong className="text-white">{backupFolderName}</strong>
                    </p>
                  </div>
                </div>
              )}

              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <p className="text-base font-bold text-slate-100">
                    {(status?.filesMigrated || reportDetails?.filesMigrated || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400">Files Migrated</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <p className="text-base font-bold text-emerald-400">
                    {(status?.filesVerified || reportDetails?.filesVerified || 0).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-slate-400">Files Verified</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <p className="text-base font-bold text-rose-400">
                    {status?.failedCount || reportDetails?.failedCount || 0}
                  </p>
                  <p className="text-[11px] text-slate-400">Failed Items</p>
                </div>
                <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                  <p className="text-base font-bold text-amber-400">
                    {status?.skippedCount || reportDetails?.skippedCount || 0}
                  </p>
                  <p className="text-[11px] text-slate-400">Skipped Items</p>
                </div>
              </div>

              {/* Failed Items Breakdown Toggle */}
              {reportDetails?.failedItems && reportDetails.failedItems.length > 0 && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4">
                  <button
                    onClick={() => setShowFailedItems(!showFailedItems)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    <span>{reportDetails.failedItems.length} items could not be imported</span>
                    <span>{showFailedItems ? 'Hide' : 'View Failed Items'}</span>
                  </button>

                  {showFailedItems && (
                    <div className="mt-3 max-h-40 overflow-y-auto space-y-1.5 pt-2 border-t border-slate-800 text-xs text-slate-300">
                      {reportDetails.failedItems.map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between bg-slate-900 p-2 rounded-lg text-[11px]">
                          <span className="truncate max-w-xs font-medium">{item.name}</span>
                          <span className="text-rose-400 text-[10px]">{item.errorReason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-3 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            {error}
          </div>
        )}

        {/* Modal Controls Footer */}
        <div className="border-t border-slate-800 pt-4 mt-4 flex items-center justify-between gap-3">
          {step === 1 && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-all shadow-md shadow-brand-600/30"
              >
                <span>Next: Options</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleStartMigration}
                disabled={loading}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-semibold text-white transition-all shadow-md shadow-brand-600/30"
              >
                <CloudDownload className="w-4 h-4" />
                <span>{loading ? 'Initializing...' : 'Start Migration'}</span>
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex items-center justify-between">
              <button
                onClick={handleCancelMigration}
                disabled={loading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all shadow-sm"
              >
                <XCircle className="w-4 h-4 text-rose-400" />
                <span>{loading ? 'Cancelling...' : 'Cancel Migration'}</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Run in Background
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="w-full flex items-center justify-between gap-3 flex-wrap">
              <button
                onClick={handleDownloadReport}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                <Download className="w-4 h-4 text-slate-400" />
                <span>Download CSV Report</span>
              </button>

              <div className="flex items-center gap-2">
                {deleteOriginals && !status?.deleteConfirmed && onRequestDeleteConfirmation && (
                  <button
                    onClick={() =>
                      onRequestDeleteConfirmation(
                        migrationId,
                        backupFolderName,
                        status?.filesVerified || reportDetails?.filesVerified || 0
                      )
                    }
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-all shadow-md shadow-rose-600/30"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Proceed to Deletion Confirmation</span>
                  </button>
                )}

                {onOpenFolder && (
                  <button
                    onClick={() => {
                      onClose();
                      if (status?.backupFolderId) {
                        onOpenFolder(status.backupFolderId);
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30"
                  >
                    <FolderPlus className="w-4 h-4" />
                    <span>Open Backup Folder</span>
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
