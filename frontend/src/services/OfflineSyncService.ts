// Zentro Drive Auto Sync Service for Offline Captured Media (By Failed Engineers)

import { offlineStorage } from './OfflineStorageService';
import { apiRequest } from './api';

class OfflineSyncService {
  private isSyncing = false;
  private listeners: Array<(status: { isSyncing: boolean; syncedCount: number }) => void> = [];

  constructor() {
    this.init();
  }

  private init() {
    // Listen for online reconnect event
    window.addEventListener('online', () => {
      console.log('[OfflineSync] Network reconnected. Starting auto-sync...');
      this.syncPendingMedia();
    });

    // Run initial sync check on app load if online
    if (navigator.onLine) {
      setTimeout(() => {
        this.syncPendingMedia();
      }, 2000);
    }
  }

  public subscribe(listener: (status: { isSyncing: boolean; syncedCount: number }) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(syncedCount: number) {
    this.listeners.forEach((l) => l({ isSyncing: this.isSyncing, syncedCount }));
  }

  public async syncPendingMedia(): Promise<number> {
    if (this.isSyncing || !navigator.onLine) return 0;

    const pendingItems = await offlineStorage.getPendingCameraSyncItems();
    if (pendingItems.length === 0) return 0;

    this.isSyncing = true;
    this.notify(0);

    let syncedCount = 0;

    for (const item of pendingItems) {
      try {
        console.log(`[OfflineSync] Uploading offline captured item: ${item.name}`);
        const fileToUpload = new File([item.blob], item.name, { type: item.mimeType });
        const formData = new FormData();
        formData.append('file', fileToUpload);
        if (item.cameraFolderId) {
          formData.append('folderId', item.cameraFolderId);
        }

        await apiRequest('/files/upload', {
          method: 'POST',
          body: formData,
        });

        // Remove from pending queue after successful upload
        await offlineStorage.removePendingCameraSyncItem(item.id);
        syncedCount++;
        this.notify(syncedCount);
      } catch (err) {
        console.error(`[OfflineSync] Failed to sync ${item.name}:`, err);
      }
    }

    this.isSyncing = false;
    this.notify(syncedCount);

    if (syncedCount > 0) {
      console.log(`[OfflineSync] Successfully auto-synced ${syncedCount} items to Zentro cloud!`);
    }

    return syncedCount;
  }
}

export const offlineSyncService = new OfflineSyncService();
