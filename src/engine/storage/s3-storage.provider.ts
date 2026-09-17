import { IStorageProvider } from './storage.provider.interface';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export class S3StorageProvider implements IStorageProvider {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: process.env.S3_REGION || 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    });
  }

  async upload(bucket: string, path: string, data: string | Buffer): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: typeof data === 'string' ? Buffer.from(data, 'utf-8') : data,
      ContentType: typeof data === 'string' ? 'text/plain' : 'application/octet-stream',
    });
    
    await this.s3.send(command);
  }

  async download(bucket: string, path: string): Promise<string | Buffer | null> {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: path,
    });

    try {
      const response = await this.s3.send(command);
      if (!response.Body) return null;
      
      const stream = response.Body as Readable;
      return new Promise<Buffer>((resolve, reject) => {
        const chunks: any[] = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (err: any) {
      if (err.name === 'NoSuchKey' || err.name === 'NotFound') {
        return null;
      }
      throw err;
    }
  }

  async delete(bucket: string, path: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: path,
    });
    
    await this.s3.send(command);
  }

  async list(bucket: string, prefix: string): Promise<string[]> {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
    });
    
    const response = await this.s3.send(command);
    return response.Contents?.map(item => item.Key!).filter(Boolean) || [];
  }
}
