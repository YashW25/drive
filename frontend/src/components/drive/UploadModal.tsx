import React from 'react';
import { UploadProgressItem } from '../../context/DriveContext';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface UploadModalProps {
  queue: UploadProgressItem[];
  onClose: () => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({ queue, onClose }) => {
  if (queue.length === 0) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 animate-pop-in">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-brand-400" />
          <span className="text-xs font-semibold">Upload Progress ({queue.length})</span>
        </div>
        <button onClick={onClose} className="p-1 rounded-md hover:bg-slate-800 text-slate-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Queue items list */}
      <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60 p-3 space-y-2">
        {queue.map((item) => {
          const percent = item.size > 0 ? Math.min(100, Math.round((item.uploadedBytes / item.size) * 100)) : 0;
          return (
            <div key={item.id} className="pt-2">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium truncate max-w-[180px]" title={item.filename}>
                  {item.filename}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {item.status === 'completed'
                    ? '100%'
                    : item.status === 'uploading'
                    ? `${percent}%`
                    : 'Failed'}
                </span>
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mb-1">
                <div
                  className={`h-full transition-all duration-200 ${
                    item.status === 'completed'
                      ? 'bg-emerald-500'
                      : item.status === 'failed'
                      ? 'bg-rose-500'
                      : 'bg-brand-500'
                  }`}
                  style={{ width: `${item.status === 'completed' ? 100 : percent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span>{formatSize(item.size)}</span>
                {item.status === 'completed' ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> Done
                  </span>
                ) : item.status === 'failed' ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Error
                  </span>
                ) : (
                  <span className="text-brand-400 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
