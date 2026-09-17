import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../services/api';

interface GoogleDeleteConfirmationModalProps {
  migrationId: string;
  backupFolderName: string;
  verifiedCount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const GoogleDeleteConfirmationModal: React.FC<GoogleDeleteConfirmationModalProps> = ({
  migrationId,
  backupFolderName,
  verifiedCount,
  onClose,
  onSuccess,
}) => {
  const [inputPhrase, setInputPhrase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const REQUIRED_PHRASE = 'DELETE MY GOOGLE DRIVE';
  const isConfirmed = inputPhrase.trim() === REQUIRED_PHRASE;

  const handleConfirmDelete = async () => {
    if (!isConfirmed) return;

    try {
      setLoading(true);
      setError(null);

      await apiRequest(`/google/migrations/${migrationId}/confirm-delete`, {
        method: 'POST',
        body: JSON.stringify({ confirmationPhrase: inputPhrase.trim() }),
      });

      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      setError(err.message || 'Failed to execute Google Drive deletion');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 animate-fade-in">
      <div className="w-full max-w-[95vw] sm:max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 relative animate-pop-in">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Permanent Google Drive Deletion</h3>
              <p className="text-xs text-slate-400 mt-0.5">Final Destructive Confirmation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Details */}
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 mb-5 space-y-2 text-xs text-rose-300">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>PERMANENT ACTION - CANNOT BE UNDONE</span>
          </div>
          <p className="leading-relaxed">
            You are about to delete <strong>{verifiedCount} verified files & folders</strong> from your Google Drive account.
            Only items successfully copied and verified in <strong>{backupFolderName}</strong> will be removed.
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Failed, skipped, or unverified items will remain safe in Google Drive.</span>
          </div>
        </div>

        {/* Confirmation Phrase Input */}
        <div className="mb-6 space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            To confirm deletion, type <span className="font-mono text-rose-400 font-bold">{REQUIRED_PHRASE}</span> below:
          </label>
          <input
            type="text"
            value={inputPhrase}
            onChange={(e) => setInputPhrase(e.target.value)}
            placeholder={REQUIRED_PHRASE}
            className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500/80 rounded-xl px-4 py-2.5 text-xs text-slate-100 font-mono placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-rose-500/50 transition-all"
          />
        </div>

        {error && (
          <div className="mb-4 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmDelete}
            disabled={!isConfirmed || loading}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all shadow-md ${
              isConfirmed && !loading
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{loading ? 'Deleting...' : 'Permanently Delete Verified Items'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
