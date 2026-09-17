import React, { useEffect, useRef } from 'react';
import {
  ExternalLink,
  Eye,
  Download,
  Edit2,
  Edit3,
  Code2,
  FolderInput,
  Copy,
  Star,
  Share2,
  Trash2,
  Lock,
  HardDriveDownload,
} from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  isFolder: boolean;
  isStarred: boolean;
  isCameraFolder?: boolean;
  isTrashed?: boolean;
  isOffline?: boolean;
  onClose: () => void;
  onOpen: () => void;
  onPreview?: () => void;
  onEdit?: () => void;
  onVsCode?: () => void;
  onDownload?: () => void;
  onRename: () => void;
  onMove: () => void;
  onCopy?: () => void;
  onToggleStar: () => void;
  onToggleOffline?: () => void;
  onShare?: () => void;
  onTrash: () => void;
  onRestore?: () => void;
  onDeletePermanent?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  isFolder,
  isStarred,
  isCameraFolder = false,
  isTrashed = false,
  isOffline = false,
  onClose,
  onOpen,
  onPreview,
  onEdit,
  onVsCode,
  onDownload,
  onRename,
  onMove,
  onCopy,
  onToggleStar,
  onToggleOffline,
  onShare,
  onTrash,
  onRestore,
  onDeletePermanent,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      style={{
        top: Math.min(y, window.innerHeight - 360),
        left: Math.min(x, window.innerWidth - 220),
      }}
      className="fixed z-50 w-56 bg-slate-900/95 border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 backdrop-blur-md animate-pop-in select-none"
    >
      {!isTrashed ? (
        <>
          <button
            onClick={() => {
              onOpen();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4 text-slate-400" />
            Open
          </button>

          {!isFolder && onEdit && (
            <button
              onClick={() => {
                onEdit();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 text-amber-300 font-medium transition-colors"
            >
              <Edit3 className="w-4 h-4 text-amber-400" />
              Edit File (Document/Data)
            </button>
          )}

          {!isFolder && onVsCode && (
            <button
              onClick={() => {
                onVsCode();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 text-blue-300 font-medium transition-colors"
            >
              <Code2 className="w-4 h-4 text-blue-400" />
              Open in VS Code Studio
            </button>
          )}

          {!isFolder && onPreview && (
            <button
              onClick={() => {
                onPreview();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
            >
              <Eye className="w-4 h-4 text-slate-400" />
              Preview File
            </button>
          )}

          {!isFolder && onDownload && (
            <button
              onClick={() => {
                onDownload();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
            >
              <Download className="w-4 h-4 text-slate-400" />
              Download
            </button>
          )}

          <div className="my-1 border-t border-slate-800" />

          {isCameraFolder ? (
            <div
              className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-500 cursor-not-allowed opacity-60 font-medium select-none"
              title="System Camera folder cannot be renamed"
            >
              <Lock className="w-4 h-4 text-slate-500" />
              <span>Rename (Protected)</span>
            </div>
          ) : (
            <button
              onClick={() => {
                onRename();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
            >
              <Edit2 className="w-4 h-4 text-slate-400" />
              Rename
            </button>
          )}

          <button
            onClick={() => {
              onMove();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
          >
            <FolderInput className="w-4 h-4 text-slate-400" />
            Move to
          </button>

          {!isFolder && onCopy && (
            <button
              onClick={() => {
                onCopy();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
            >
              <Copy className="w-4 h-4 text-slate-400" />
              Make a copy
            </button>
          )}

          <button
            onClick={() => {
              onToggleStar();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
          >
            <Star className={`w-4 h-4 ${isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            {isStarred ? 'Remove from Starred' : 'Add to Starred'}
          </button>

          {onToggleOffline && (
            <button
              onClick={() => {
                onToggleOffline();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
            >
              <HardDriveDownload className={`w-4 h-4 ${isOffline ? 'text-emerald-400' : 'text-slate-400'}`} />
              <span className={isOffline ? 'text-emerald-300 font-medium' : ''}>
                {isOffline ? 'Remove Offline Access' : 'Make Available Offline'}
              </span>
            </button>
          )}

          {onShare && (
            <button
              onClick={() => {
                onShare();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-brand-600/30 hover:text-white transition-colors"
            >
              <Share2 className="w-4 h-4 text-slate-400" />
              Share / Get link
            </button>
          )}

          <div className="my-1 border-t border-slate-800" />

          <button
            onClick={() => {
              onTrash();
              onClose();
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Move to Trash
          </button>
        </>
      ) : (
        <>
          {onRestore && (
            <button
              onClick={() => {
                onRestore();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-emerald-600/30 hover:text-white transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-emerald-400" />
              Restore
            </button>
          )}
          {onDeletePermanent && (
            <button
              onClick={() => {
                onDeletePermanent();
                onClose();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Permanently
            </button>
          )}
        </>
      )}
    </div>
  );
};
