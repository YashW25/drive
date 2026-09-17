import { Readable } from 'stream';

export interface StorageMetadata {
  objectId: string;
  size: number;
  mimeType: string;
  hash: string;
  createdAt: Date;
  providerSpecific?: Record<string, any>;
}

export interface UploadOptions {
  filename: string;
  mimeType: string;
  size: number;
  userId: string;
  onProgress?: (bytesUploaded: number, totalBytes: number) => void;
}

export interface UploadResult {
  objectId: string;
  size: number;
  hash: string;
  provider: string;
  providerSpecific: {
    telegramFileId?: string;
    telegramMessageId?: number;
    telegramChatId?: string;
    [key: string]: any;
  };
}

export interface DownloadResult {
  stream: Readable;
  mimeType: string;
  size: number;
  filename: string;
}

export interface AccessOptions {
  expiresInSeconds?: number;
  downloadFilename?: string;
}

export interface StorageProvider {
  name: string;

  /**
   * Uploads a file buffer or stream to storage backend.
   */
  upload(
    fileBuffer: Buffer | Readable,
    options: UploadOptions
  ): Promise<UploadResult>;

  /**
   * Downloads a file stream from storage backend.
   */
  download(objectId: string): Promise<DownloadResult>;

  /**
   * Deletes a file from storage backend.
   */
  delete(objectId: string): Promise<boolean>;

  /**
   * Retrieves metadata for a file in storage.
   */
  getMetadata(objectId: string): Promise<StorageMetadata | null>;

  /**
   * Generates a signed or temporary direct access URL/stream handle if applicable.
   */
  generateAccess(
    objectId: string,
    options?: AccessOptions
  ): Promise<string | null>;

  /**
   * Checks if an object exists in storage backend.
   */
  exists(objectId: string): Promise<boolean>;
}
