import React from 'react';
import {
  CheckSquare,
  Square,
  Star,
  Download,
  Trash2,
  RefreshCw,
  X,
  Check,
} from 'lucide-react';

interface BulkActionsToolbarProps {
  selectedCount: number;
  totalCount: number;
  isAllSelected: boolean;
  isTrashed?: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkStar: () => void;
  onBulkDownload: () => void;
  onBulkTrash: () => void;
  onBulkRestore?: () => void;
  onBulkDeletePermanent?: () => void;
}

export const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
  selectedCount,
  totalCount,
  isAllSelected,
  isTrashed = false,
  onSelectAll,
  onClearSelection,
  onBulkStar,
  onBulkDownload,
  onBulkTrash,
  onBulkRestore,
  onBulkDeletePermanent,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-md text-slate-100 animate-pop-in select-none">
      {/* Selection Summary */}
      <div className="flex items-center gap-2 border-r border-slate-800 pr-4">
        <button
          onClick={onSelectAll}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
        >
          {isAllSelected ? (
            <CheckSquare className="w-4 h-4" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          {isAllSelected ? 'Deselect All' : `Select All (${totalCount})`}
        </button>
        <span className="text-xs font-mono text-slate-400">
          • <strong className="text-slate-100">{selectedCount}</strong> selected
        </span>
      </div>

      {/* Bulk Action Buttons */}
      <div className="flex items-center gap-2">
        {!isTrashed ? (
          <>
            <button
              onClick={onBulkStar}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-xl text-xs font-medium transition-colors border border-slate-700"
              title="Star selected items"
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Star</span>
            </button>

            <button
              onClick={onBulkDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors border border-slate-700"
              title="Download selected files"
            >
              <Download className="w-3.5 h-3.5 text-brand-400" />
              <span>Download</span>
            </button>

            <button
              onClick={onBulkTrash}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-colors border border-rose-500/30"
              title="Move selected items to trash"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Move to Trash</span>
            </button>
          </>
        ) : (
          <>
            {onBulkRestore && (
              <button
                onClick={onBulkRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold transition-colors border border-emerald-500/30"
              >
                <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restore Selected</span>
              </button>
            )}

            {onBulkDeletePermanent && (
              <button
                onClick={onBulkDeletePermanent}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded-xl text-xs font-semibold transition-colors border border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Delete Permanently</span>
              </button>
            )}
          </>
        )}
      </div>

      {/* Clear Selection Button */}
      <button
        onClick={onClearSelection}
        className="p-1.5 ml-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
        title="Clear Selection"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
