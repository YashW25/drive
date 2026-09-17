import React, { useState } from 'react';
import { FolderItem, FileItem, useDrive } from '../../context/DriveContext';
import { ContextMenu } from './ContextMenu';
import {
  Folder,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  Star,
  Download,
  MoreVertical,
  Check,
  Camera,
  HardDriveDownload,
} from 'lucide-react';

interface FileListProps {
  folders: FolderItem[];
  files: FileItem[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, isFolder: boolean) => void;
  onSelectAll?: () => void;
  isAllSelected?: boolean;
  onOpenFolder: (id: string) => void;
  onOpenFile: (file: FileItem) => void;
  onEditFile?: (file: FileItem) => void;
  onVsCodeFile?: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onToggleStar: (id: string, isFolder: boolean) => void;
  onRename: (id: string, isFolder: boolean) => void;
  onMove: (id: string, isFolder: boolean) => void;
  onTrash: (id: string, isFolder: boolean) => void;
  onRestore?: (id: string, isFolder: boolean) => void;
  onDeletePermanent?: (id: string, isFolder: boolean) => void;
  isTrashed?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  folders,
  files,
  selectedIds = new Set(),
  onToggleSelect,
  onSelectAll,
  isAllSelected = false,
  onOpenFolder,
  onOpenFile,
  onEditFile,
  onVsCodeFile,
  onDownloadFile,
  onToggleStar,
  onRename,
  onMove,
  onTrash,
  onRestore,
  onDeletePermanent,
  isTrashed = false,
}) => {
  const { isItemOffline, makeAvailableOffline, removeAvailableOffline } = useDrive();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: { id: string; isFolder: boolean; isStarred: boolean; isCameraFolder?: boolean; file?: FileItem };
  } | null>(null);

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-5 h-5 text-sky-400" />;
    if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-indigo-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-5 h-5 text-emerald-400" />;
    if (mimeType.includes('pdf')) return <FileText className="w-5 h-5 text-rose-400" />;
    if (mimeType.includes('zip') || mimeType.includes('tar')) return <Archive className="w-5 h-5 text-amber-400" />;
    return <FileText className="w-5 h-5 text-brand-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="w-full overflow-x-auto select-none">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-slate-700/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {onSelectAll && (
              <th className="pb-3 pl-3 w-10">
                <button
                  onClick={onSelectAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                    isAllSelected
                      ? 'bg-brand-500 border-brand-500 text-white'
                      : 'border-slate-600 hover:border-slate-400 bg-slate-900'
                  }`}
                >
                  {isAllSelected && <Check className="w-3 h-3 stroke-[3]" />}
                </button>
              </th>
            )}
            <th className="pb-3 pl-2">Name</th>
            <th className="pb-3 hidden sm:table-cell">Type</th>
            <th className="pb-3 hidden md:table-cell">Size</th>
            <th className="pb-3 hidden lg:table-cell">Modified</th>
            <th className="pb-3 pr-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 text-xs text-slate-200">
          {/* Folders */}
          {folders.map((folder) => {
            const isSelected = selectedIds.has(folder.id);
            const isCameraFolder =
              folder.name.toLowerCase() === 'camera' &&
              (folder.parentFolderId === null || folder.parentFolderId === undefined);

            return (
              <tr
                key={folder.id}
                onDoubleClick={() => onOpenFolder(folder.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    item: { id: folder.id, isFolder: true, isStarred: folder.isStarred, isCameraFolder },
                  });
                }}
                className={`group cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-brand-600/20 text-white font-medium'
                    : isCameraFolder
                    ? 'bg-emerald-950/20 hover:bg-emerald-950/40 text-slate-100'
                    : 'hover:bg-slate-800/50'
                }`}
              >
                {onToggleSelect && (
                  <td className="py-3 pl-3 w-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(folder.id, true);
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'border-slate-600 group-hover:border-slate-400 bg-slate-900/60'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  </td>
                )}
                <td className="py-3 pl-2 flex items-center gap-3">
                  {isCameraFolder ? (
                    <div className="p-1 bg-emerald-500/20 border border-emerald-500/30 rounded-md flex-shrink-0">
                      <Camera className="w-4 h-4 text-emerald-400" />
                    </div>
                  ) : (
                    <Folder className="w-5 h-5 text-brand-400 fill-brand-400/20 flex-shrink-0" />
                  )}
                  <span className={`font-medium truncate ${isCameraFolder ? 'text-emerald-300 font-bold' : ''}`}>
                    {folder.name}
                  </span>
                  {isItemOffline(folder.id) && (
                    <span title="Saved Offline">
                      <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    </span>
                  )}
                  {isCameraFolder && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Camera App
                    </span>
                  )}
                </td>
                <td className="py-3 hidden sm:table-cell text-slate-400">Folder</td>
                <td className="py-3 hidden md:table-cell text-slate-400">—</td>
                <td className="py-3 hidden lg:table-cell text-slate-400">{formatDate(folder.updatedAt)}</td>
                <td className="py-3 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onToggleStar(folder.id, true)}
                      className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400"
                    >
                      <Star className={`w-4 h-4 ${folder.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          item: { id: folder.id, isFolder: true, isStarred: folder.isStarred },
                        });
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}

          {/* Files */}
          {files.map((file) => {
            const isSelected = selectedIds.has(file.id);
            return (
              <tr
                key={file.id}
                onDoubleClick={() => onOpenFile(file)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    item: { id: file.id, isFolder: false, isStarred: file.isStarred, file },
                  });
                }}
                className={`group cursor-pointer transition-colors ${
                  isSelected ? 'bg-brand-600/20 text-white font-medium' : 'hover:bg-slate-800/50'
                }`}
              >
                {onToggleSelect && (
                  <td className="py-3 pl-3 w-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(file.id, false);
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'border-slate-600 group-hover:border-slate-400 bg-slate-900/60'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  </td>
                )}
                <td className="py-3 pl-2 flex items-center gap-3">
                  {getFileIcon(file.mimeType)}
                  <span className="font-medium truncate" title={file.name}>
                    {file.name}
                  </span>
                  {isItemOffline(file.id) && (
                    <span title="Saved Offline">
                      <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    </span>
                  )}
                  {file.isGoogleDriveBackup && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[10px] font-semibold text-blue-300 ml-2">
                      Google Drive Backup
                    </span>
                  )}
                </td>
                <td className="py-3 hidden sm:table-cell text-slate-400 uppercase font-medium">
                  {file.extension || 'FILE'}
                </td>
                <td className="py-3 hidden md:table-cell text-slate-400">{formatSize(file.size)}</td>
                <td className="py-3 hidden lg:table-cell text-slate-400">{formatDate(file.updatedAt)}</td>
                <td className="py-3 pr-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => onDownloadFile(file)}
                      className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400 hover:text-slate-200"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onToggleStar(file.id, false)}
                      className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400"
                    >
                      <Star className={`w-4 h-4 ${file.isStarred ? 'text-amber-400 fill-amber-400' : ''}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          item: { id: file.id, isFolder: false, isStarred: file.isStarred, file },
                        });
                      }}
                      className="p-1.5 rounded-md hover:bg-slate-700/60 text-slate-400"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isFolder={contextMenu.item.isFolder}
          isStarred={contextMenu.item.isStarred}
          isCameraFolder={contextMenu.item.isCameraFolder}
          isTrashed={isTrashed}
          isOffline={isItemOffline(contextMenu.item.id)}
          onClose={() => setContextMenu(null)}
          onOpen={() =>
            contextMenu.item.isFolder
              ? onOpenFolder(contextMenu.item.id)
              : onOpenFile(contextMenu.item.file!)
          }
          onPreview={() => contextMenu.item.file && onOpenFile(contextMenu.item.file)}
          onEdit={() => contextMenu.item.file && onEditFile && onEditFile(contextMenu.item.file)}
          onVsCode={() => contextMenu.item.file && onVsCodeFile && onVsCodeFile(contextMenu.item.file)}
          onDownload={() => contextMenu.item.file && onDownloadFile(contextMenu.item.file)}
          onRename={() => onRename(contextMenu.item.id, contextMenu.item.isFolder)}
          onMove={() => onMove(contextMenu.item.id, contextMenu.item.isFolder)}
          onToggleStar={() => onToggleStar(contextMenu.item.id, contextMenu.item.isFolder)}
          onToggleOffline={() => {
            if (isItemOffline(contextMenu.item.id)) {
              removeAvailableOffline(contextMenu.item.id, contextMenu.item.isFolder);
            } else {
              const target = contextMenu.item.isFolder
                ? folders.find((f) => f.id === contextMenu.item.id)
                : contextMenu.item.file;
              if (target) makeAvailableOffline(target, contextMenu.item.isFolder);
            }
          }}
          onTrash={() => onTrash(contextMenu.item.id, contextMenu.item.isFolder)}
          onRestore={() => onRestore && onRestore(contextMenu.item.id, contextMenu.item.isFolder)}
          onDeletePermanent={() =>
            onDeletePermanent && onDeletePermanent(contextMenu.item.id, contextMenu.item.isFolder)
          }
        />
      )}
    </div>
  );
};
