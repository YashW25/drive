import { IStorageProvider } from './storage.provider.interface';
import * as fs from 'fs';
import * as path from 'path';

export class LocalStorageProvider implements IStorageProvider {
  constructor(private readonly baseDir: string = process.cwd()) {}

  async upload(bucket: string, objectPath: string, data: string | Buffer): Promise<void> {
    const fullPath = path.join(this.baseDir, bucket, objectPath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, data);
  }

  async download(bucket: string, objectPath: string): Promise<string | Buffer | null> {
    const fullPath = path.join(this.baseDir, bucket, objectPath);
    try {
      return await fs.promises.readFile(fullPath);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(bucket: string, objectPath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, bucket, objectPath);
    try {
      await fs.promises.unlink(fullPath);
    } catch (err: any) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async list(bucket: string, prefix: string): Promise<string[]> {
    const fullPath = path.join(this.baseDir, bucket, prefix);
    try {
      const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
      return entries.filter(e => e.isFile()).map(e => e.name);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }
}
