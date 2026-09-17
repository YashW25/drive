import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';
import {
  StorageProvider,
  UploadOptions,
  UploadResult,
  DownloadResult,
  StorageMetadata,
  AccessOptions,
} from './StorageProvider.js';

export class LocalStorageProvider implements StorageProvider {
  name = 'LOCAL';
  private storageDir: string;

  constructor(baseDir?: string) {
    this.storageDir = path.resolve(baseDir || process.env.LOCAL_STORAGE_DIR || './storage_data');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  async upload(
    fileInput: Buffer | Readable,
    options: UploadOptions
  ): Promise<UploadResult> {
    const objectId = `local_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const filePath = path.join(this.storageDir, objectId);

    let buffer: Buffer;
    if (Buffer.isBuffer(fileInput)) {
      buffer = fileInput;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of fileInput) {
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    await fs.promises.writeFile(filePath, buffer);

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    if (options.onProgress) {
      options.onProgress(buffer.length, buffer.length);
    }

    return {
      objectId,
      size: buffer.length,
      hash,
      provider: this.name,
      providerSpecific: {
        localPath: filePath,
      },
    };
  }

  async download(objectId: string): Promise<DownloadResult> {
    const filePath = path.join(this.storageDir, objectId);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File object ${objectId} not found in local storage`);
    }

    const stat = await fs.promises.stat(filePath);
    const stream = fs.createReadStream(filePath);

    return {
      stream,
      mimeType: 'application/octet-stream',
      size: stat.size,
      filename: objectId,
    };
  }

  async delete(objectId: string): Promise<boolean> {
    const filePath = path.join(this.storageDir, objectId);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      return true;
    }
    return false;
  }

  async getMetadata(objectId: string): Promise<StorageMetadata | null> {
    const filePath = path.join(this.storageDir, objectId);
    if (!fs.existsSync(filePath)) return null;

    const stat = await fs.promises.stat(filePath);
    return {
      objectId,
      size: stat.size,
      mimeType: 'application/octet-stream',
      hash: '',
      createdAt: stat.birthtime,
      providerSpecific: { localPath: filePath },
    };
  }

  async generateAccess(
    objectId: string,
    options?: AccessOptions
  ): Promise<string | null> {
    return `/api/download/raw/${objectId}`;
  }

  async exists(objectId: string): Promise<boolean> {
    const filePath = path.join(this.storageDir, objectId);
    return fs.existsSync(filePath);
  }
}
