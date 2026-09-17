import React, { useState, useRef } from 'react';
import { useDrive, FileItem, FolderItem } from '../context/DriveContext';
import { DriveLayout } from '../components/layout/DriveLayout';
import { Breadcrumb } from '../components/drive/Breadcrumb';
import { FileGrid } from '../components/drive/FileGrid';
import { FileList } from '../components/drive/FileList';
import { StorageDashboard } from '../components/drive/StorageDashboard';
import { FileViewerModal } from '../components/viewers/FileViewerModal';
import { UniversalEditorModal } from '../components/editors/UniversalEditorModal';
import { BulkActionsToolbar } from '../components/drive/BulkActionsToolbar';
import { AskFilesDrawer } from '../components/ai/AskFilesDrawer';
import { UploadModal } from '../components/drive/UploadModal';
import { CameraCaptureModal } from '../components/camera/CameraCaptureModal';
import { SettingsPage } from './SettingsPage';
import { CameraPage } from './CameraPage';
import { apiRequest } from '../services/api';
import { isCodeFile } from '../utils/fileTypes';
import { HardDrive, UploadCloud, X, Copy, Share2, Check, Trash2, AlertTriangle, Filter } from 'lucide-react';

export const DrivePage: React.FC = () => {
  const {
    currentFolderId,
    setCurrentFolderId,
    breadcrumbs,
    folders,
    files: rawFiles,
    loading,
    viewMode,
    activeView,
    setActiveView,
    uploadQueue,
    uploadFiles,
    uploadFolder,
    createFolder,
    renameItem,
    trashItem,
    restoreItem,
    deletePermanent,
    toggleStar,
    bulkTrash,
    bulkRestore,
    bulkDeletePermanent,
    bulkStar,
    emptyDrive,
    emptyTrash,
  } = useDrive();

  // Source Filter state ('all' | 'teledrive' | 'google')
  const [sourceFilter, setSourceFilter] = useState<'all' | 'teledrive' | 'google'>('all');

  const files = rawFiles.filter((file) => {
    if (sourceFilter === 'teledrive') return !file.isGoogleDriveBackup;
    if (sourceFilter === 'google') return file.isGoogleDriveBackup;
    return true;
  });

  // URL query params check for Settings / Google OAuth callback
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'settings' || params.get('google') === 'connected') {
      setActiveView('settings');
    }
  }, []);

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedItemMap, setSelectedItemMap] = useState<Map<string, { id: string; isFolder: boolean; file?: FileItem }>>(new Map());

  const [viewerFile, setViewerFile] = useState<FileItem | null>(null);
  const [editorFile, setEditorFile] = useState<FileItem | null>(null);
  const [forceVsCode, setForceVsCode] = useState<boolean>(false);

  const [askAIOpen, setAskAIOpen] = useState(false);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Modals state
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderNameInput, setFolderNameInput] = useState('');

  const [renameModal, setRenameModal] = useState<{ id: string; name: string; isFolder: boolean } | null>(null);
  const [renameInput, setRenameInput] = useState('');

  const [shareModal, setShareModal] = useState<{ id: string; isFolder: boolean; link?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Empty Drive & Trash confirmation modals
  const [emptyDriveModalOpen, setEmptyDriveModalOpen] = useState(false);
  const [emptyTrashModalOpen, setEmptyTrashModalOpen] = useState(false);
  const [isEmptying, setIsEmptying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const allItems = [
    ...folders.map((f) => ({ id: f.id, isFolder: true })),
    ...files.map((f) => ({ id: f.id, isFolder: false, file: f })),
  ];
  const totalCount = allItems.length;
  const isAllSelected = totalCount > 0 && selectedIds.size === totalCount;

  // Toggle selection for a single item
  const handleToggleSelect = (id: string, isFolder: boolean) => {
    const nextIds = new Set(selectedIds);
    const nextMap = new Map(selectedItemMap);

    if (nextIds.has(id)) {
      nextIds.delete(id);
      nextMap.delete(id);
    } else {
      nextIds.add(id);
      const fileObj = !isFolder ? files.find((f) => f.id === id) : undefined;
      nextMap.set(id, { id, isFolder, file: fileObj });
    }

    setSelectedIds(nextIds);
    setSelectedItemMap(nextMap);
  };

  // Toggle Select All
  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
      setSelectedItemMap(new Map());
    } else {
      const nextIds = new Set<string>();
      const nextMap = new Map<string, { id: string; isFolder: boolean; file?: FileItem }>();

      folders.forEach((f) => {
        nextIds.add(f.id);
        nextMap.set(f.id, { id: f.id, isFolder: true });
      });

      files.forEach((f) => {
        nextIds.add(f.id);
        nextMap.set(f.id, { id: f.id, isFolder: false, file: f });
      });

      setSelectedIds(nextIds);
      setSelectedItemMap(nextMap);
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
    setSelectedItemMap(new Map());
  };

  // Bulk actions
  const handleBulkStarAction = async () => {
    const items = Array.from(selectedItemMap.values());
    await bulkStar(items);
    handleClearSelection();
  };

  const handleBulkTrashAction = async () => {
    const items = Array.from(selectedItemMap.values());
    await bulkTrash(items);
    handleClearSelection();
  };

  const handleBulkRestoreAction = async () => {
    const items = Array.from(selectedItemMap.values());
    await bulkRestore(items);
    handleClearSelection();
  };

  const handleBulkDeletePermanentAction = async () => {
    const items = Array.from(selectedItemMap.values());
    await bulkDeletePermanent(items);
    handleClearSelection();
  };

  const handleBulkDownloadAction = () => {
    const items = Array.from(selectedItemMap.values());
    items.forEach((item) => {
      if (!item.isFolder && item.file) {
        handleDownload(item.file);
      }
    });
  };

  const handleConfirmEmptyDrive = async () => {
    try {
      setIsEmptying(true);
      await emptyDrive();
      handleClearSelection();
      setIsEmptying(false);
      setEmptyDriveModalOpen(false);
    } catch (err) {
      setIsEmptying(false);
    }
  };

  const handleConfirmEmptyTrash = async () => {
    try {
      setIsEmptying(true);
      await emptyTrash();
      handleClearSelection();
      setIsEmptying(false);
      setEmptyTrashModalOpen(false);
    } catch (err) {
      setIsEmptying(false);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const extractedFiles: File[] = [];

      const traverseEntry = async (entry: any, path = '') => {
        if (entry.isFile) {
          await new Promise<void>((resolve) => {
            entry.file((file: File) => {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: path ? `${path}/${file.name}` : file.name,
              });
              extractedFiles.push(file);
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          const reader = entry.createReader();
          const entries: any[] = await new Promise((resolve) => reader.readEntries(resolve));
          for (const childEntry of entries) {
            await traverseEntry(childEntry, path ? `${path}/${entry.name}` : entry.name);
          }
        }
      };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          await traverseEntry(entry);
        } else if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) extractedFiles.push(file);
        }
      }

      if (extractedFiles.length > 0) {
        uploadFolder(extractedFiles);
        setUploadModalOpen(true);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      setUploadModalOpen(true);
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFolder(e.target.files);
      setUploadModalOpen(true);
    }
  };

  const handleDownload = (file: FileItem) => {
    const token = localStorage.getItem('teledrive_token');
    const downloadUrl = `/api/files/${file.id}/download?token=${token}`;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleEditFile = (file: FileItem) => {
    setViewerFile(null);
    setEditorFile(file);
    setForceVsCode(false);
  };

  const handleVsCodeFile = (file: FileItem) => {
    setViewerFile(null);
    setEditorFile(file);
    setForceVsCode(true);
  };

  const handleOpenVsCodeStudio = () => {
    const codeFile = files.find((f) => isCodeFile(f.name)) || files[0];
    if (codeFile) {
      handleVsCodeFile(codeFile);
    } else {
      const dummyCodeFile: FileItem = {
        id: 'draft-code',
        name: 'script.js',
        originalName: 'script.js',
        size: 0,
        mimeType: 'text/javascript',
        extension: 'js',
        hash: 'draft',
        storageProvider: 'zentro',
        isStarred: false,
        isTrashed: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      handleVsCodeFile(dummyCodeFile);
    }
  };

  const handleShareClick = async (id: string, isFolder: boolean) => {
    try {
      const res = await apiRequest<{ shareUrl: string }>('/share', {
        method: 'POST',
        body: JSON.stringify({
          fileId: !isFolder ? id : undefined,
          folderId: isFolder ? id : undefined,
        }),
      });
      const fullUrl = `${window.location.origin}${res.shareUrl}`;
      setShareModal({ id, isFolder, link: fullUrl });
    } catch (err) {
      console.error('Share generation error:', err);
    }
  };

  const isEmpty = folders.length === 0 && files.length === 0;

  return (
    <DriveLayout
      onOpenAskAI={() => setAskAIOpen(true)}
      onNewFolder={() => {
        setFolderNameInput('');
        setNewFolderOpen(true);
      }}
      onUploadClick={() => fileInputRef.current?.click()}
      onUploadFolderClick={() => folderInputRef.current?.click()}
      onCameraClick={() => setCameraModalOpen(true)}
      onOpenVsCode={handleOpenVsCodeStudio}
    >
      {/* File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        className="hidden"
      />

      {/* Folder Input */}
      <input
        type="file"
        ref={folderInputRef}
        onChange={handleFolderChange}
        {...({ webkitdirectory: '', directory: '', multiple: true } as any)}
        className="hidden"
      />

      {/* Main Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className="h-full flex flex-col relative"
      >
        {/* Drag & Drop Overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-40 bg-brand-600/20 backdrop-blur-sm border-2 border-dashed border-brand-400 rounded-2xl flex flex-col items-center justify-center text-brand-300 pointer-events-none animate-fade-in">
            <UploadCloud className="w-16 h-16 mb-2 text-brand-400 animate-bounce" />
            <p className="text-base font-bold">Drop files or folders here to upload to Zentro Drive</p>
          </div>
        )}

        {/* Action Header Controls */}
        <div className="mb-4 flex items-center justify-between gap-4">
          {activeView === 'drive' ? (
            <Breadcrumb items={breadcrumbs} onSelect={(id) => setCurrentFolderId(id)} />
          ) : (
            <div className="h-6" />
          )}

          <div className="flex items-center gap-2 text-xs">
            {activeView === 'drive' && (
              <>
                {/* Source Filter Select */}
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-300">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <select
                    value={sourceFilter}
                    onChange={(e) => setSourceFilter(e.target.value as any)}
                    className="bg-transparent font-medium focus:outline-none text-slate-200 cursor-pointer"
                  >
                    <option value="all" className="bg-slate-900 text-slate-200">All Sources</option>
                    <option value="teledrive" className="bg-slate-900 text-slate-200">Zentro Drive Only</option>
                    <option value="google" className="bg-slate-900 text-slate-200">Google Drive Backup</option>
                  </select>
                </div>

                <button
                  onClick={() => setEmptyDriveModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/50 rounded-xl font-semibold text-rose-400 transition-colors shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Empty Drive
                </button>
              </>
            )}

            {activeView === 'trash' && totalCount > 0 && (
              <button
                onClick={() => setEmptyTrashModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 border border-rose-500/20 hover:border-rose-500/50 rounded-xl font-semibold text-rose-400 transition-colors shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" /> Empty Trash
              </button>
            )}

            {totalCount > 0 && activeView !== 'settings' && activeView !== 'storage' && (
              <button
                onClick={handleSelectAll}
                className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl font-medium text-slate-300 hover:text-white transition-colors"
              >
                {isAllSelected ? 'Deselect All' : `Select All (${totalCount})`}
              </button>
            )}
          </div>
        </div>

        {/* Content Views */}
        {activeView === 'settings' ? (
          <SettingsPage />
        ) : activeView === 'camera' ? (
          <CameraPage />
        ) : activeView === 'storage' ? (
          <StorageDashboard onEmptyDrive={() => setEmptyDriveModalOpen(true)} />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-xs">
            Loading files...
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <HardDrive className="w-16 h-16 text-slate-700 mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No items found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {activeView === 'drive'
                ? 'Upload your first file/folder or create a folder to get started.'
                : activeView === 'starred'
                ? 'No starred files or folders yet.'
                : activeView === 'trash'
                ? 'Trash is empty.'
                : 'No recent files.'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <FileGrid
            folders={folders}
            files={files}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onOpenFolder={(id) => setCurrentFolderId(id)}
            onOpenFile={(file) => setViewerFile(file)}
            onEditFile={handleEditFile}
            onVsCodeFile={handleVsCodeFile}
            onDownloadFile={handleDownload}
            onToggleStar={toggleStar}
            onRename={(id, isFolder) => {
              const item = isFolder ? folders.find((f) => f.id === id) : files.find((f) => f.id === id);
              if (item) {
                setRenameInput(item.name);
                setRenameModal({ id, name: item.name, isFolder });
              }
            }}
            onMove={(id, isFolder) => {}}
            onTrash={trashItem}
            onRestore={restoreItem}
            onDeletePermanent={deletePermanent}
            isTrashed={activeView === 'trash'}
          />
        ) : (
          <FileList
            folders={folders}
            files={files}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
            isAllSelected={isAllSelected}
            onOpenFolder={(id) => setCurrentFolderId(id)}
            onOpenFile={(file) => setViewerFile(file)}
            onEditFile={handleEditFile}
            onVsCodeFile={handleVsCodeFile}
            onDownloadFile={handleDownload}
            onToggleStar={toggleStar}
            onRename={(id, isFolder) => {
              const item = isFolder ? folders.find((f) => f.id === id) : files.find((f) => f.id === id);
              if (item) {
                if (
                  isFolder &&
                  item.name.toLowerCase() === 'camera' &&
                  ((item as FolderItem).parentFolderId === null || (item as FolderItem).parentFolderId === undefined)
                ) {
                  alert('The system Camera folder is protected and cannot be renamed.');
                  return;
                }
                setRenameInput(item.name);
                setRenameModal({ id, name: item.name, isFolder });
              }
            }}
            onMove={(id, isFolder) => {}}
            onTrash={trashItem}
            onRestore={restoreItem}
            onDeletePermanent={deletePermanent}
            isTrashed={activeView === 'trash'}
          />
        )}
      </div>

      {/* Bulk Floating Actions Bar */}
      <BulkActionsToolbar
        selectedCount={selectedIds.size}
        totalCount={totalCount}
        isAllSelected={isAllSelected}
        isTrashed={activeView === 'trash'}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkStar={handleBulkStarAction}
        onBulkDownload={handleBulkDownloadAction}
        onBulkTrash={handleBulkTrashAction}
        onBulkRestore={handleBulkRestoreAction}
        onBulkDeletePermanent={handleBulkDeletePermanentAction}
      />

      {/* Empty Drive Confirmation Modal */}
      {emptyDriveModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 animate-pop-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Empty Drive Storage?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Permanent Bulk Purge Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Are you sure you want to empty your drive? This will permanently delete <strong>all files and folders</strong> stored in your Zentro Drive account. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEmptyDriveModalOpen(false)}
                disabled={isEmptying}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEmptyDrive}
                disabled={isEmptying}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors shadow-lg shadow-rose-600/20"
              >
                {isEmptying ? 'Purging Drive...' : 'Yes, Empty Drive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty Trash Confirmation Modal */}
      {emptyTrashModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 animate-pop-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-100">Empty Trash?</h3>
                <p className="text-xs text-slate-400 mt-0.5">Permanent Deletion</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Are you sure you want to permanently delete all items in Trash?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setEmptyTrashModalOpen(false)}
                disabled={isEmptying}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmEmptyTrash}
                disabled={isEmptying}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-semibold text-white transition-colors shadow-lg shadow-rose-600/20"
              >
                {isEmptying ? 'Emptying Trash...' : 'Yes, Empty Trash'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Integrated File Viewer Modal */}
      {viewerFile && (
        <FileViewerModal
          file={viewerFile}
          onClose={() => setViewerFile(null)}
          onDownload={() => handleDownload(viewerFile)}
          onToggleStar={() => toggleStar(viewerFile.id, false)}
          onShare={() => handleShareClick(viewerFile.id, false)}
          onEdit={() => handleEditFile(viewerFile)}
        />
      )}

      {/* Universal Editor / VS Code Studio Modal */}
      {editorFile && (
        <UniversalEditorModal
          file={editorFile}
          onClose={() => setEditorFile(null)}
          forceVsCode={forceVsCode}
        />
      )}

      {/* Ask AI Drawer */}
      {askAIOpen && <AskFilesDrawer onClose={() => setAskAIOpen(false)} />}

      {/* Upload Progress Queue */}
      {uploadModalOpen && (
        <UploadModal queue={uploadQueue} onClose={() => setUploadModalOpen(false)} />
      )}

      {/* Create New Folder Modal */}
      {newFolderOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 animate-pop-in">
            <h3 className="text-sm font-semibold mb-4">New Folder</h3>
            <input
              type="text"
              value={folderNameInput}
              onChange={(e) => setFolderNameInput(e.target.value)}
              placeholder="Folder name"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500 mb-6"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setNewFolderOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (folderNameInput.trim()) {
                    createFolder(folderNameInput.trim());
                    setNewFolderOpen(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-medium text-white"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 animate-pop-in">
            <h3 className="text-sm font-semibold mb-4">Rename Item</h3>
            <input
              type="text"
              value={renameInput}
              onChange={(e) => setRenameInput(e.target.value)}
              placeholder="New name"
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500 mb-6"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRenameModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (renameInput.trim()) {
                    renameItem(renameModal.id, renameInput.trim(), renameModal.isFolder);
                    setRenameModal(null);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-xs font-medium text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl text-slate-100 animate-pop-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Share2 className="w-5 h-5 text-brand-400" />
                <h3 className="text-sm font-semibold">Share Link</h3>
              </div>
              <button onClick={() => setShareModal(null)} className="p-1 rounded-md hover:bg-slate-800 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Anyone with this secure link can view or download this item.
            </p>

            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl p-2 mb-6">
              <input
                type="text"
                readOnly
                value={shareModal.link || ''}
                className="flex-1 bg-transparent text-xs text-slate-200 focus:outline-none truncate"
              />
              <button
                onClick={() => {
                  if (shareModal.link) {
                    navigator.clipboard.writeText(shareModal.link);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Capture Modal */}
      {cameraModalOpen && (
        <CameraCaptureModal
          onClose={() => setCameraModalOpen(false)}
          onSuccess={() => {
            setCameraModalOpen(false);
          }}
        />
      )}
    </DriveLayout>
  );
};
