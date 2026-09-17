import React from 'react';
import { useDrive } from '../../context/DriveContext';
import { HardDrive, FileText, Image as ImageIcon, Video, Music, Archive, Folder } from 'lucide-react';

interface StorageDashboardProps {
  onEmptyDrive?: () => void;
}

export const StorageDashboard: React.FC<StorageDashboardProps> = ({ onEmptyDrive }) => {
  const { storageInfo } = useDrive();

  if (!storageInfo) {
    return <div className="p-8 text-center text-slate-400">Loading storage metrics...</div>;
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const categories = [
    { name: 'Documents', bytes: storageInfo.categories?.Documents || 0, icon: FileText, color: 'bg-rose-500', text: 'text-rose-400' },
    { name: 'Images', bytes: storageInfo.categories?.Images || 0, icon: ImageIcon, color: 'bg-sky-500', text: 'text-sky-400' },
    { name: 'Videos', bytes: storageInfo.categories?.Videos || 0, icon: Video, color: 'bg-indigo-500', text: 'text-indigo-400' },
    { name: 'Audio', bytes: storageInfo.categories?.Audio || 0, icon: Music, color: 'bg-emerald-500', text: 'text-emerald-400' },
    { name: 'Archives', bytes: storageInfo.categories?.Archives || 0, icon: Archive, color: 'bg-amber-500', text: 'text-amber-400' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Hero Storage Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold font-heading text-slate-100 mb-1">Storage Usage</h2>
            <p className="text-xs text-slate-400">Zentro Cloud Storage Engine Active — By Failed Engineers</p>
          </div>
          <div className="flex items-center gap-3">
            {onEmptyDrive && (
              <button
                onClick={onEmptyDrive}
                className="px-3.5 py-2 bg-rose-500/10 border border-rose-500/30 hover:border-rose-500/60 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 transition-all shadow-sm"
              >
                Empty Drive
              </button>
            )}
            <div className="p-3 bg-brand-600/20 border border-brand-500/30 rounded-xl text-brand-400">
              <HardDrive className="w-8 h-8" />
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-2xl font-extrabold text-slate-100">
              {formatSize(storageInfo.totalBytes)} <span className="text-xs font-normal text-slate-400">used</span>
            </span>
            <span className="text-xs font-medium text-slate-400">
              {storageInfo.totalFiles} files • {storageInfo.totalFolders} folders
            </span>
          </div>

          {/* Combined Progress Bar */}
          <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden flex">
            {categories.map((cat) => {
              const percent = storageInfo.totalBytes > 0 ? (cat.bytes / storageInfo.totalBytes) * 100 : 0;
              if (percent <= 0) return null;
              return (
                <div
                  key={cat.name}
                  className={`h-full ${cat.color} transition-all`}
                  style={{ width: `${percent}%` }}
                  title={`${cat.name}: ${formatSize(cat.bytes)}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          return (
            <div
              key={cat.name}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-700 transition-colors"
            >
              <div className={`p-3 rounded-xl bg-slate-800/80 ${cat.text}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-xs font-medium text-slate-400">{cat.name}</h4>
                <p className="text-sm font-semibold text-slate-100 mt-0.5">{formatSize(cat.bytes)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
