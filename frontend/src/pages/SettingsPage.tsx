import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  CloudDownload,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  ExternalLink,
  Shield,
  RefreshCw,
  FolderArchive,
  Download,
  X,
  Database,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { apiRequest } from '../services/api';
import { GoogleMigrationWizardModal } from '../components/google/GoogleMigrationWizardModal';
import { GoogleDeleteConfirmationModal } from '../components/google/GoogleDeleteConfirmationModal';

interface GoogleStatus {
  isConnected: boolean;
  email?: string;
  connectedAt?: string;
}

interface MigrationHistoryItem {
  id: string;
  backupFolderName: string;
  status: string;
  filesMigrated: number;
  totalFiles: number;
  totalBytes: string;
  deleteOriginals: boolean;
  deleteConfirmed: boolean;
  completedAt: string;
}

export const SettingsPage: React.FC = () => {
  const [googleStatus, setGoogleStatus] = useState<GoogleStatus | null>(null);
  const [history, setHistory] = useState<MigrationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [disconnectModalOpen, setDisconnectModalOpen] = useState(false);
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [deleteConfirmationModal, setDeleteConfirmationModal] = useState<{
    migrationId: string;
    backupFolderName: string;
    verifiedCount: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, []);

  const toggleExpand = (id: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const fetchStatus = async () => {
    try {
      const res = await apiRequest<GoogleStatus>('/google/status');
      setGoogleStatus(res);
    } catch (err: any) {
      console.error('Failed to fetch Google connection status:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await apiRequest<MigrationHistoryItem[]>('/google/migrations');
      setHistory(res);
    } catch (err: any) {
      console.error('Failed to fetch migration history:', err);
    }
  };

  const handleConnectGoogleDrive = async () => {
    try {
      setError(null);
      const res = await apiRequest<{ url: string }>('/google/auth-url');
      if (res.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initiate Google OAuth');
    }
  };

  const handleStartScan = async () => {
    try {
      setScanning(true);
      setError(null);
      const res = await apiRequest('/google/scan', { method: 'POST' });
      setScanResult(res);
      setScanning(false);
      setWizardOpen(true);
    } catch (err: any) {
      setScanning(false);
      setError(err.message || 'Failed to scan Google Drive');
    }
  };

  const handleDisconnect = async () => {
    try {
      setError(null);
      await apiRequest('/google/disconnect', { method: 'POST' });
      setDisconnectModalOpen(false);
      fetchStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect Google Drive');
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in py-2 sm:py-4 px-1 sm:px-0">
      {/* Page Title */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold font-heading text-slate-100 mb-1">Settings & Connections</h2>
        <p className="text-xs text-slate-400">Manage connected cloud accounts and migration history</p>
      </div>

      {error && (
        <div className="text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
          {error}
        </div>
      )}

      {/* Connected Storage Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 sm:p-2.5 bg-brand-600/20 border border-brand-500/30 rounded-xl text-brand-400 flex-shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 font-heading">Connected Storage</h3>
              <p className="text-[11px] sm:text-xs text-slate-400">Manage external cloud providers and backup sync</p>
            </div>
          </div>
        </div>

        {/* Google Drive Block */}
        <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 sm:gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-emerald-500 to-amber-500 p-0.5 shadow-md flex-shrink-0">
                <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center font-extrabold text-blue-400 text-sm">
                  G
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-bold text-slate-100">Google Drive</h4>
                  {googleStatus?.isConnected ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[11px] font-semibold text-rose-400 whitespace-nowrap">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      Not Connected
                    </span>
                  )}
                </div>
                {googleStatus?.isConnected && (
                  <p className="text-xs text-slate-400 mt-0.5 font-medium truncate max-w-[200px] sm:max-w-xs">{googleStatus.email}</p>
                )}
              </div>
            </div>

            {/* Google Drive Action Buttons */}
            <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto flex-wrap sm:flex-nowrap">
              {googleStatus?.isConnected ? (
                <>
                  <button
                    onClick={handleStartScan}
                    disabled={scanning}
                    className="flex-1 sm:flex-none justify-center flex items-center gap-1.5 px-3.5 sm:px-4 py-2 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 rounded-xl text-xs font-semibold text-white transition-all shadow-md shadow-brand-600/20 whitespace-nowrap"
                  >
                    {scanning ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Scanning Drive...</span>
                      </>
                    ) : (
                      <>
                        <CloudDownload className="w-4 h-4" />
                        <span>Import / Backup</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setDisconnectModalOpen(true)}
                    className="px-3 sm:px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-300 transition-colors whitespace-nowrap"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  onClick={handleConnectGoogleDrive}
                  className="w-full sm:w-auto justify-center flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-semibold text-white transition-all shadow-lg shadow-blue-600/30 whitespace-nowrap"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Connect Google Drive</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Migration History Section */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-brand-400 flex-shrink-0" />
            <h3 className="text-sm sm:text-base font-bold text-slate-100 font-heading">Migration History</h3>
          </div>
          <span className="text-xs text-slate-400">{history.length} past runs</span>
        </div>

        {history.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            No previous Google Drive migrations found.
          </div>
        ) : (
          <>
            {/* Mobile Dropdown Accordion View (< sm) */}
            <div className="sm:hidden space-y-2.5">
              {history.map((item) => {
                const isExpanded = expandedItemIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    className="bg-slate-950/60 border border-slate-800/80 rounded-xl overflow-hidden transition-all duration-200"
                  >
                    {/* Folder Header Trigger */}
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <FolderArchive className="w-4 h-4 text-brand-400 flex-shrink-0" />
                        <span className="text-xs font-semibold text-slate-200 truncate">{item.backupFolderName}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'COMPLETED_WITH_ERRORS'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {item.status}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>

                    {/* Expandable Dropdown Details */}
                    {isExpanded && (
                      <div className="p-3 border-t border-slate-800/60 bg-slate-900/50 text-xs space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/60">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Files Migrated</span>
                            <span className="font-mono text-slate-200 font-medium text-xs mt-0.5 block">
                              {item.filesMigrated} / {item.totalFiles}
                            </span>
                          </div>
                          <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/60">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Size</span>
                            <span className="font-mono text-brand-300 font-medium text-xs mt-0.5 block">
                              {formatSize(item.totalBytes)}
                            </span>
                          </div>
                        </div>

                        <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/60 flex items-center justify-between gap-2">
                          <div>
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Completion Date</span>
                            <span className="text-slate-300 font-medium text-xs">
                              {new Date(item.completedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const token = localStorage.getItem('teledrive_token');
                              window.open(`/api/google/migrations/${item.id}/report/download?token=${token}`, '_blank');
                            }}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 shadow-sm"
                          >
                            <Download className="w-3.5 h-3.5 text-brand-400" />
                            <span>View Report</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= sm) */}
            <div className="hidden sm:block w-full overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
              <table className="w-full text-left text-xs text-slate-300 min-w-[580px]">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-900/60">
                    <th className="py-3 px-3">Backup Folder</th>
                    <th className="py-3 px-3">Files Migrated</th>
                    <th className="py-3 px-3">Total Size</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {history.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-medium text-slate-200">
                        <div className="flex items-center gap-2 max-w-[150px] sm:max-w-xs truncate" title={item.backupFolderName}>
                          <FolderArchive className="w-4 h-4 text-brand-400 flex-shrink-0" />
                          <span className="truncate">{item.backupFolderName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">
                        {item.filesMigrated} / {item.totalFiles}
                      </td>
                      <td className="py-3 px-3 font-mono whitespace-nowrap">{formatSize(item.totalBytes)}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            item.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : item.status === 'COMPLETED_WITH_ERRORS'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                        {new Date(item.completedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => {
                            const token = localStorage.getItem('teledrive_token');
                            window.open(`/api/google/migrations/${item.id}/report/download?token=${token}`, '_blank');
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium transition-colors"
                        >
                          View Report
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Migration Wizard Modal */}
      {wizardOpen && scanResult && (
        <GoogleMigrationWizardModal
          scanResult={scanResult}
          onClose={() => {
            setWizardOpen(false);
            fetchHistory();
          }}
          onOpenFolder={(folderId) => {
            window.location.href = `/drive?folder=${folderId}`;
          }}
          onRequestDeleteConfirmation={(migId, backupName, count) => {
            setWizardOpen(false);
            setDeleteConfirmationModal({
              migrationId: migId,
              backupFolderName: backupName,
              verifiedCount: count,
            });
          }}
        />
      )}

      {/* Safe Disconnect Modal */}
      {disconnectModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 animate-pop-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Disconnect Google Drive?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Revoke Access Credentials</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Your imported TeleDrive files will <strong>NOT</strong> be deleted. Disconnecting only removes TeleDrive’s authorization to scan or copy files from your Google Drive account.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setDisconnectModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDisconnect}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-all shadow-md shadow-rose-600/30"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Google Delete Confirmation Modal */}
      {deleteConfirmationModal && (
        <GoogleDeleteConfirmationModal
          migrationId={deleteConfirmationModal.migrationId}
          backupFolderName={deleteConfirmationModal.backupFolderName}
          verifiedCount={deleteConfirmationModal.verifiedCount}
          onClose={() => setDeleteConfirmationModal(null)}
          onSuccess={() => {
            setDeleteConfirmationModal(null);
            fetchHistory();
          }}
        />
      )}
    </div>
  );
};
