import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../services/api';
import { useAuth } from './AuthContext';
import { offlineStorage } from '../services/OfflineStorageService';

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  hash: string;
  storageProvider: string;
  isStarred: boolean;
  isTrashed: boolean;
  isGoogleDriveBackup?: boolean;
  googleDriveFileId?: string;
  googleDriveSourcePath?: string;
  createdAt: string;
  updatedAt: string;
  previews?: Array<{ id: string; previewType: string; previewPath: string; metadataJson: string }>;
}

export interface FolderItem {
  id: string;
  name: string;
  parentFolderId: string | null;
  isStarred: boolean;
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export interface UploadProgressItem {
  id: string;
  filename: string;
  size: number;
  uploadedBytes: number;
  status: 'uploading' | 'completed' | 'failed' | 'cancelled';
  speed?: string;
  etaSeconds?: number;
}

interface DriveContextType {
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  breadcrumbs: BreadcrumbItem[];
  folders: FolderItem[];
  files: FileItem[];
  loading: boolean;
  isOnline: boolean;
  offlineItemIds: Set<string>;
  viewMode: 'grid' | 'list';
  setViewMode: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  activeView: 'drive' | 'camera' | 'recent' | 'starred' | 'trash' | 'storage' | 'settings' | 'offline';
  setActiveView: (view: 'drive' | 'camera' | 'recent' | 'starred' | 'trash' | 'storage' | 'settings' | 'offline') => void;
  uploadQueue: UploadProgressItem[];
  uploadFiles: (filesList: FileList | File[], allowDuplicate?: boolean) => Promise<void>;
  uploadFolder: (filesList: FileList | File[]) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  renameItem: (id: string, newName: string, isFolder: boolean) => Promise<void>;
  trashItem: (id: string, isFolder: boolean) => Promise<void>;
  restoreItem: (id: string, isFolder: boolean) => Promise<void>;
  deletePermanent: (id: string, isFolder: boolean) => Promise<void>;
  toggleStar: (id: string, isFolder: boolean) => Promise<void>;
  makeAvailableOffline: (item: FileItem | FolderItem, isFolder: boolean) => Promise<void>;
  removeAvailableOffline: (id: string, isFolder: boolean) => Promise<void>;
  isItemOffline: (id: string) => boolean;
  bulkTrash: (items: Array<{ id: string; isFolder: boolean }>) => Promise<void>;
  bulkRestore: (items: Array<{ id: string; isFolder: boolean }>) => Promise<void>;
  bulkDeletePermanent: (items: Array<{ id: string; isFolder: boolean }>) => Promise<void>;
  bulkStar: (items: Array<{ id: string; isFolder: boolean }>) => Promise<void>;
  emptyDrive: () => Promise<void>;
  emptyTrash: () => Promise<void>;
  refreshDrive: () => Promise<void>;

  previewFile: FileItem | null;
  setPreviewFile: (file: FileItem | null) => void;
  storageInfo: { totalBytes: number; totalFiles: number; totalFolders: number; categories: Record<string, number> } | null;
}

const DriveContext = createContext<DriveContextType | undefined>(undefined);

export const DriveProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: 'My Drive' }]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineItemIds, setOfflineItemIds] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeView, setActiveView] = useState<'drive' | 'camera' | 'recent' | 'starred' | 'trash' | 'storage' | 'settings' | 'offline'>('drive');
  const [uploadQueue, setUploadQueue] = useState<UploadProgressItem[]>([]);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [storageInfo, setStorageInfo] = useState<any>(null);

  // Monitor online status & offline item ids
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    offlineStorage.getOfflineItemIds().then(setOfflineItemIds);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const refreshDrive = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // If device is offline or user selected Offline view tab: fetch from IndexedDB
    if (!navigator.onLine || activeView === 'offline') {
      try {
        const offlineData = await offlineStorage.getAllOfflineItems();
        setFiles(offlineData.files as FileItem[]);
        setFolders(offlineData.folders as FolderItem[]);
        setBreadcrumbs([{ id: null, name: 'Offline Saved Files' }]);
      } catch (err) {
        console.error('Failed to load offline files:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const storagePromise = apiRequest<any>('/files/view/storage').then(res => setStorageInfo(res)).catch(console.error);

      if (activeView === 'drive') {
        const res = await apiRequest<{
          currentFolderId: string | null;
          breadcrumbs: BreadcrumbItem[];
          folders: FolderItem[];
          files: FileItem[];
        }>(`/folders?folderId=${currentFolderId || ''}&q=${encodeURIComponent(searchQuery)}`);
        setFolders(res.folders);
        setFiles(res.files);
        setBreadcrumbs(res.breadcrumbs || [{ id: null, name: 'My Drive' }]);
      } else if (activeView === 'recent') {
        const res = await apiRequest<FileItem[]>('/files/view/recent');
        setFiles(res);
        setFolders([]);
      } else if (activeView === 'starred') {
        const res = await apiRequest<{ folders: FolderItem[]; files: FileItem[] }>('/files/view/starred');
        setFolders(res.folders);
        setFiles(res.files);
      } else if (activeView === 'trash') {
        const res = await apiRequest<{ folders: FolderItem[]; files: FileItem[] }>('/files/view/trash');
        setFolders(res.folders);
        setFiles(res.files);
      }

      await storagePromise;
    } catch (err) {
      console.warn('Network request failed, falling back to cached offline items:', err);
      const offlineData = await offlineStorage.getAllOfflineItems();
      setFiles(offlineData.files as FileItem[]);
      setFolders(offlineData.folders as FolderItem[]);
    } finally {
      setLoading(false);
    }
  }, [user, currentFolderId, searchQuery, activeView]);

  useEffect(() => {
    refreshDrive();
  }, [refreshDrive]);

  const makeAvailableOffline = async (item: FileItem | FolderItem, isFolder: boolean) => {
    try {
      if (isFolder) {
        await offlineStorage.saveFolderOffline(item);
      } else {
        await offlineStorage.saveFileOffline(item);
      }
      const updatedIds = await offlineStorage.getOfflineItemIds();
      setOfflineItemIds(updatedIds);
    } catch (err) {
      console.error('Failed to make available offline:', err);
      throw err;
    }
  };

  const removeAvailableOffline = async (id: string, isFolder: boolean) => {
    try {
      if (isFolder) {
        await offlineStorage.removeFolderOffline(id);
      } else {
        await offlineStorage.removeFileOffline(id);
      }
      const updatedIds = await offlineStorage.getOfflineItemIds();
      setOfflineItemIds(updatedIds);
      if (activeView === 'offline') {
        refreshDrive();
      }
    } catch (err) {
      console.error('Failed to remove offline access:', err);
      throw err;
    }
  };

  const isItemOffline = (id: string) => {
    return offlineItemIds.has(id);
  };

  const createFolder = async (name: string) => {
    await apiRequest('/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parentFolderId: currentFolderId }),
    });
    refreshDrive();
  };

  const uploadFiles = async (filesList: FileList | File[], allowDuplicate: boolean = true) => {
    const fileArray = Array.from(filesList);
    for (const file of fileArray) {
      const queueId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setUploadQueue((prev) => [
        ...prev,
        {
          id: queueId,
          filename: file.name,
          size: file.size,
          uploadedBytes: 0,
          status: 'uploading',
        },
      ]);

      const formData = new FormData();
      formData.append('file', file);
      if (currentFolderId) formData.append('folderId', currentFolderId);
      formData.append('allowDuplicate', String(allowDuplicate));

      try {
        await apiRequest('/files/upload', {
          method: 'POST',
          body: formData,
        });

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueId ? { ...item, uploadedBytes: file.size, status: 'completed' } : item
          )
        );
      } catch (err) {
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === queueId ? { ...item, status: 'failed' } : item))
        );
      }
    }
    refreshDrive();
  };

  const uploadFolder = async (filesList: FileList | File[]) => {
    const fileArray = Array.from(filesList);
    const folderCache = new Map<string, string>();

    const getOrCreateTargetFolderId = async (relativePath: string): Promise<string | null> => {
      const parts = relativePath.split('/');
      if (parts.length <= 1) return currentFolderId;

      const folderSegments = parts.slice(0, -1);
      let parentId = currentFolderId;
      let accumulatedPath = '';

      for (const segment of folderSegments) {
        accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segment}` : segment;
        if (folderCache.has(accumulatedPath)) {
          parentId = folderCache.get(accumulatedPath)!;
        } else {
          try {
            const res = await apiRequest<{ id: string }>('/folders', {
              method: 'POST',
              body: JSON.stringify({ name: segment, parentFolderId: parentId }),
            });
            parentId = res.id;
            folderCache.set(accumulatedPath, res.id);
          } catch (err) {
            console.error(`Failed to create folder ${segment}:`, err);
          }
        }
      }
      return parentId;
    };

    for (const file of fileArray) {
      const relativePath = (file as any).webkitRelativePath || (file as any).relativePath || file.name;
      const targetFolderId = await getOrCreateTargetFolderId(relativePath);

      const queueId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      setUploadQueue((prev) => [
        ...prev,
        {
          id: queueId,
          filename: relativePath,
          size: file.size,
          uploadedBytes: 0,
          status: 'uploading',
        },
      ]);

      const formData = new FormData();
      formData.append('file', file);
      if (targetFolderId) formData.append('folderId', targetFolderId);
      formData.append('allowDuplicate', 'true');

      try {
        await apiRequest('/files/upload', {
          method: 'POST',
          body: formData,
        });

        setUploadQueue((prev) =>
          prev.map((item) =>
            item.id === queueId ? { ...item, uploadedBytes: file.size, status: 'completed' } : item
          )
        );
      } catch (err) {
        setUploadQueue((prev) =>
          prev.map((item) => (item.id === queueId ? { ...item, status: 'failed' } : item))
        );
      }
    }
    refreshDrive();
  };

  const renameItem = async (id: string, newName: string, isFolder: boolean) => {
    const endpoint = isFolder ? `/folders/${id}/rename` : `/files/${id}/rename`;
    await apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify({ name: newName }),
    });
    refreshDrive();
  };

  const trashItem = async (id: string, isFolder: boolean) => {
    const endpoint = isFolder ? `/folders/${id}` : `/files/${id}`;
    await apiRequest(endpoint, { method: 'DELETE' });
    refreshDrive();
  };

  const restoreItem = async (id: string, isFolder: boolean) => {
    const endpoint = isFolder ? `/folders/${id}/restore` : `/files/${id}/restore`;
    await apiRequest(endpoint, { method: 'POST' });
    refreshDrive();
  };

  const deletePermanent = async (id: string, isFolder: boolean) => {
    const endpoint = isFolder ? `/folders/${id}/permanent` : `/files/${id}/permanent`;
    await apiRequest(endpoint, { method: 'DELETE' });
    refreshDrive();
  };

  const toggleStar = async (id: string, isFolder: boolean) => {
    const endpoint = isFolder ? `/folders/${id}/star` : `/files/${id}/star`;
    await apiRequest(endpoint, { method: 'PATCH' });
    refreshDrive();
  };

  const bulkTrash = async (items: Array<{ id: string; isFolder: boolean }>) => {
    for (const item of items) {
      const endpoint = item.isFolder ? `/folders/${item.id}` : `/files/${item.id}`;
      await apiRequest(endpoint, { method: 'DELETE' }).catch(() => {});
    }
    refreshDrive();
  };

  const bulkRestore = async (items: Array<{ id: string; isFolder: boolean }>) => {
    for (const item of items) {
      const endpoint = item.isFolder ? `/folders/${item.id}/restore` : `/files/${item.id}/restore`;
      await apiRequest(endpoint, { method: 'POST' }).catch(() => {});
    }
    refreshDrive();
  };

  const bulkDeletePermanent = async (items: Array<{ id: string; isFolder: boolean }>) => {
    for (const item of items) {
      const endpoint = item.isFolder ? `/folders/${item.id}/permanent` : `/files/${item.id}/permanent`;
      await apiRequest(endpoint, { method: 'DELETE' }).catch(() => {});
    }
    refreshDrive();
  };

  const bulkStar = async (items: Array<{ id: string; isFolder: boolean }>) => {
    for (const item of items) {
      const endpoint = item.isFolder ? `/folders/${item.id}/star` : `/files/${item.id}/star`;
      await apiRequest(endpoint, { method: 'PATCH' }).catch(() => {});
    }
    refreshDrive();
  };

  const emptyDrive = async () => {
    await apiRequest('/files/view/drive/empty', { method: 'POST' });
    refreshDrive();
  };

  const emptyTrash = async () => {
    await apiRequest('/files/view/trash/empty', { method: 'POST' });
    refreshDrive();
  };


  return (
    <DriveContext.Provider
      value={{
        currentFolderId,
        setCurrentFolderId,
        breadcrumbs,
        folders,
        files,
        loading,
        isOnline,
        offlineItemIds,
        viewMode,
        setViewMode,
        searchQuery,
        setSearchQuery,
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
        makeAvailableOffline,
        removeAvailableOffline,
        isItemOffline,
        bulkTrash,
        bulkRestore,
        bulkDeletePermanent,
        bulkStar,
        emptyDrive,
        emptyTrash,
        refreshDrive,

        previewFile,
        setPreviewFile,
        storageInfo,
      }}
    >
      {children}
    </DriveContext.Provider>
  );
};

export const useDrive = () => {
  const ctx = useContext(DriveContext);
  if (!ctx) throw new Error('useDrive must be used within DriveProvider');
  return ctx;
};
