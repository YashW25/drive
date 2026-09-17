import { StorageProvider } from './StorageProvider.js';
import { TelegramStorageProvider } from './TelegramStorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';

export class StorageFactory {
  private static instance: StorageProvider;

  public static getProvider(): StorageProvider {
    if (!StorageFactory.instance) {
      const providerType = process.env.STORAGE_PROVIDER || 'TELEGRAM';
      if (providerType === 'LOCAL') {
        StorageFactory.instance = new LocalStorageProvider();
      } else {
        StorageFactory.instance = new TelegramStorageProvider();
      }
    }
    return StorageFactory.instance;
  }
}
