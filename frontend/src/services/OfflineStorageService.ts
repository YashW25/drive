// TeleDrive IndexedDB Offline Storage Service

const DB_NAME = 'teledrive_offline_db';
const DB_VERSION = 2;
const STORE_FILES = 'offline_files';
const STORE_FOLDERS = 'offline_folders';
const STORE_API_CACHE = 'offline_api_cache';
const STORE_CAMERA_SYNC = 'offline_camera_sync';

export interface OfflineStoredFile {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  hash?: string;
  storageProvider?: string;
  isStarred?: boolean;
  isTrashed?: boolean;
  blob: Blob;
  updatedAt: string;
}

export interface OfflineStoredFolder {
  id: string;
  name: string;
  parentFolderId: string | null;
  isStarred?: boolean;
  isTrashed?: boolean;
  updatedAt: string;
}

export interface OfflineCameraSyncItem {
  id: string;
  name: string;
  type: 'photo' | 'video';
  mimeType: string;
  size: number;
  blob: Blob;
  cameraFolderId: string | null;
  createdAt: number;
}

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FOLDERS)) {
          db.createObjectStore(STORE_FOLDERS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_API_CACHE)) {
          db.createObjectStore(STORE_API_CACHE, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORE_CAMERA_SYNC)) {
          db.createObjectStore(STORE_CAMERA_SYNC, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // --- API CACHE METHODS ---
  async cacheApiData(key: string, data: any): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(STORE_API_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_API_CACHE);
      store.put({ key, data, timestamp: Date.now() });
    } catch (err) {
      console.warn('Failed to cache API response:', err);
    }
  }

  async getCachedApiData(key: string): Promise<any | null> {
    try {
      const db = await this.initDB();
      const tx = db.transaction(STORE_API_CACHE, 'readonly');
      const store = tx.objectStore(STORE_API_CACHE);
      return new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => resolve(null);
      });
    } catch (err) {
      return null;
    }
  }

  // --- SAVE FILE OFFLINE ---
  async saveFileOffline(file: any): Promise<void> {
    const db = await this.initDB();

    // Fetch file blob from backend
    const token = localStorage.getItem('teledrive_token');
    const downloadUrl = `/api/files/${file.id}/download?token=${token}`;
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file content for offline caching: ${response.statusText}`);
    }

    const blob = await response.blob();

    const offlineRecord: OfflineStoredFile = {
      id: file.id,
      name: file.name,
      originalName: file.originalName || file.name,
      mimeType: file.mimeType,
      extension: file.extension || '',
      size: file.size || blob.size,
      hash: file.hash || '',
      storageProvider: file.storageProvider || 'zentro',
      isStarred: !!file.isStarred,
      isTrashed: !!file.isTrashed,
      blob,
      updatedAt: file.updatedAt || new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      const req = store.put(offlineRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- REMOVE FILE OFFLINE ---
  async removeFileOffline(fileId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      const req = store.delete(fileId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- SAVE FOLDER OFFLINE ---
  async saveFolderOffline(folder: any): Promise<void> {
    const db = await this.initDB();

    const offlineFolderRecord: OfflineStoredFolder = {
      id: folder.id,
      name: folder.name,
      parentFolderId: folder.parentFolderId || null,
      isStarred: !!folder.isStarred,
      isTrashed: !!folder.isTrashed,
      updatedAt: folder.updatedAt || new Date().toISOString(),
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FOLDERS, 'readwrite');
      const store = tx.objectStore(STORE_FOLDERS);
      const req = store.put(offlineFolderRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // Recursively fetch folder contents from backend to cache all subfiles & subfolders
    try {
      const token = localStorage.getItem('teledrive_token');
      const res = await fetch(`/api/folders?folderId=${folder.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        for (const subFile of data.files || []) {
          await this.saveFileOffline(subFile).catch(console.error);
        }
        for (const subFolder of data.folders || []) {
          await this.saveFolderOffline(subFolder).catch(console.error);
        }
      }
    } catch (err) {
      console.warn('Failed to recursively cache folder items:', err);
    }
  }

  // --- REMOVE FOLDER OFFLINE ---
  async removeFolderOffline(folderId: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FOLDERS, 'readwrite');
      const store = tx.objectStore(STORE_FOLDERS);
      const req = store.delete(folderId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // --- GET ALL OFFLINE ITEM IDS ---
  async getOfflineItemIds(): Promise<Set<string>> {
    try {
      const db = await this.initDB();
      const ids = new Set<string>();

      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_FILES, 'readonly');
        const store = tx.objectStore(STORE_FILES);
        const req = store.openKeyCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            ids.add(String(cursor.key));
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });

      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_FOLDERS, 'readonly');
        const store = tx.objectStore(STORE_FOLDERS);
        const req = store.openKeyCursor();
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            ids.add(String(cursor.key));
            cursor.continue();
          } else {
            resolve();
          }
        };
        req.onerror = () => resolve();
      });

      return ids;
    } catch (err) {
      return new Set();
    }
  }

  // --- GET ALL OFFLINE FILES & FOLDERS ---
  async getAllOfflineItems(): Promise<{ files: any[]; folders: any[] }> {
    const db = await this.initDB();

    const files: any[] = await new Promise((resolve) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    const folders: any[] = await new Promise((resolve) => {
      const tx = db.transaction(STORE_FOLDERS, 'readonly');
      const store = tx.objectStore(STORE_FOLDERS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });

    return { files, folders };
  }

  // --- GET OFFLINE FILE BLOB URL ---
  async getOfflineFileUrl(fileId: string): Promise<string | null> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const req = store.get(fileId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          const url = URL.createObjectURL(req.result.blob);
          resolve(url);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  }

  // --- CAMERA OFFLINE SYNC QUEUE ---
  async enqueueOfflineCameraMedia(item: OfflineCameraSyncItem): Promise<void> {
    const db = await this.initDB();

    // 1. Put into camera sync queue
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CAMERA_SYNC, 'readwrite');
      const store = tx.objectStore(STORE_CAMERA_SYNC);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });

    // 2. Also put into offline_files store so it immediately displays in offline files
    const offlineRecord: OfflineStoredFile = {
      id: item.id,
      name: item.name,
      originalName: item.name,
      mimeType: item.mimeType,
      extension: item.name.split('.').pop() || '',
      size: item.size,
      blob: item.blob,
      updatedAt: new Date(item.createdAt).toISOString(),
    };

    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      const req = store.put(offlineRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getPendingCameraSyncItems(): Promise<OfflineCameraSyncItem[]> {
    const db = await this.initDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_CAMERA_SYNC, 'readonly');
      const store = tx.objectStore(STORE_CAMERA_SYNC);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async removePendingCameraSyncItem(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_CAMERA_SYNC, 'readwrite');
      const store = tx.objectStore(STORE_CAMERA_SYNC);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }
}

export const offlineStorage = new OfflineStorageService();
