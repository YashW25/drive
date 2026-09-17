import React, { useState, useRef } from 'react';
import { FolderItem, FileItem, useDrive } from '../../context/DriveContext';
import { HoverPreviewPopover } from './HoverPreviewPopover';
import { ContextMenu } from './ContextMenu';
import { FileCardPreview } from './FileCardPreview';
import {
  Folder,
  Star,
  MoreVertical,
  Check,
  Camera,
  HardDriveDownload,
} from 'lucide-react';

interface FileGridProps {
  folders: FolderItem[];
  files: FileItem[];
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string, isFolder: boolean) => void;
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

export const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  selectedIds = new Set(),
  onToggleSelect,
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
  const [hoveredFile, setHoveredFile] = useState<FileItem | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const hoverTimer = useRef<NodeJS.Timeout | null>(null);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    item: { id: string; isFolder: boolean; isStarred: boolean; isCameraFolder?: boolean; file?: FileItem };
  } | null>(null);

  const handleMouseEnter = (file: FileItem, e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    hoverTimer.current = setTimeout(() => {
      setHoveredFile(file);
      setHoverPos({ x: clientX, y: clientY });
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => {
      setHoveredFile(null);
    }, 300);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="relative select-none">
      {/* Folder Section */}
      {folders.length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Folders</h3>
          <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
            {folders.map((folder) => {
              const isSelected = selectedIds.has(folder.id);
              const isCameraFolder =
                folder.name.toLowerCase() === 'camera' &&
                (folder.parentFolderId === null || folder.parentFolderId === undefined);

              return (
                <div
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
                  className={`group relative flex items-center gap-2.5 p-2.5 sm:p-3 rounded-xl cursor-pointer transition-all duration-150 shadow-sm hover:shadow-md min-w-0 overflow-hidden ${
                    isSelected
                      ? 'bg-brand-600/20 border-2 border-brand-500 text-slate-100 shadow-brand-500/10'
                      : isCameraFolder
                      ? 'bg-gradient-to-r from-emerald-950/60 via-slate-900 to-indigo-950/60 border border-emerald-500/50 hover:border-emerald-400 text-slate-100 shadow-md shadow-emerald-950/30'
                      : 'bg-slate-800/40 hover:bg-slate-800/80 border border-slate-700/50 hover:border-brand-500/50 text-slate-200'
                  }`}
                >
                  {/* Selection Checkbox */}
                  {onToggleSelect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSelect(folder.id, true);
                      }}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-brand-500 border-brand-500 text-white'
                          : 'border-slate-600 group-hover:border-slate-400 bg-slate-900/60 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </button>
                  )}

                  {isCameraFolder ? (
                    <div className="p-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center justify-center flex-shrink-0 shadow-inner">
                      <Camera className="w-5 h-5 text-emerald-400" />
                    </div>
                  ) : (
                    <Folder className="w-6 h-6 text-brand-400 fill-brand-400/20 flex-shrink-0" />
                  )}

                  <div className="flex flex-col truncate flex-1">
                    <div className="flex items-center gap-1 min-w-0">
                      <span className={`text-xs font-semibold truncate ${isCameraFolder ? 'text-emerald-300 font-bold' : ''}`} title={folder.name}>
                        {folder.name}
                      </span>
                      {isItemOffline(folder.id) && (
                        <span title="Saved Offline">
                          <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        </span>
                      )}
                    </div>
                    {isCameraFolder && (
                      <span className="text-[9px] font-mono text-emerald-400/90 font-bold uppercase tracking-wider">
                        Camera App
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center gap-1 transition-opacity ${folder.isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleStar(folder.id, true);
                      }}
                      className="p-1.5 rounded-full hover:bg-slate-700/60"
                    >
                      <Star className={`w-3.5 h-3.5 ${folder.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({
                          x: e.clientX,
                          y: e.clientY,
                          item: { id: folder.id, isFolder: true, isStarred: folder.isStarred, isCameraFolder },
                        });
                      }}
                      className="p-1.5 rounded-full hover:bg-slate-700/60"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Files</h3>
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {files.map((file) => {
              const isSelected = selectedIds.has(file.id);
              return (
                <div
                  key={file.id}
                  onDoubleClick={() => onOpenFile(file)}
                  onMouseEnter={(e) => handleMouseEnter(file, e)}
                  onMouseLeave={handleMouseLeave}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      item: { id: file.id, isFolder: false, isStarred: file.isStarred, file },
                    });
                  }}
                  className={`group relative flex flex-col rounded-xl overflow-hidden cursor-pointer transition-all duration-150 shadow-sm hover:shadow-lg ${
                    isSelected
                      ? 'bg-brand-600/20 border-2 border-brand-500 shadow-brand-500/10'
                      : 'bg-slate-800/40 hover:bg-slate-800/90 border border-slate-700/50 hover:border-brand-500/60'
                  }`}
                >
                  {/* Thumbnail Card Preview Header */}
                  <div className="w-full h-28 bg-slate-950 flex items-center justify-center relative overflow-hidden border-b border-slate-700/40">
                    <FileCardPreview file={file} />

                    {/* Left Checkbox */}
                    {onToggleSelect && (
                      <div className="absolute top-2 left-2 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleSelect(file.id, false);
                          }}
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-brand-500 border-brand-500 text-white opacity-100 shadow-md'
                              : 'border-slate-600 group-hover:border-slate-300 bg-slate-900/80 backdrop-blur-md opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>
                      </div>
                    )}

                    {/* Right Star & Options */}
                    <div className={`absolute top-2 right-2 flex items-center gap-1 z-10 transition-opacity ${file.isStarred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleStar(file.id, false);
                        }}
                        className="p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md"
                      >
                        <Star className={`w-3.5 h-3.5 ${file.isStarred ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
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
                        className="p-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 backdrop-blur-md"
                      >
                        <MoreVertical className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    </div>
                  </div>

                  {/* File Details */}
                  <div className="p-3 flex items-center gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate flex-1" title={file.name}>
                          {file.name}
                        </p>
                        {isItemOffline(file.id) && (
                          <span title="Saved Offline">
                            <HardDriveDownload className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400">{formatSize(file.size)}</span>
                        {file.isGoogleDriveBackup && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-semibold text-blue-300">
                            Google Drive
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hover Preview Popover Overlay */}
      {hoveredFile && (
        <HoverPreviewPopover
          file={hoveredFile}
          position={hoverPos}
          onOpen={() => onOpenFile(hoveredFile)}
          onDownload={() => onDownloadFile(hoveredFile)}
          onMouseEnter={() => {
            if (hoverTimer.current) clearTimeout(hoverTimer.current);
          }}
          onMouseLeave={handleMouseLeave}
        />
      )}

      {/* Context Menu Overlay */}
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
