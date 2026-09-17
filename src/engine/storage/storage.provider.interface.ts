export interface IStorageProvider {
  /** Uploads data to the specified path in a bucket. */
  upload(bucket: string, path: string, data: string | Buffer): Promise<void>;
  
  /** Downloads data from the specified path in a bucket. */
  download(bucket: string, path: string): Promise<string | Buffer | null>;
  
  /** Deletes a file at the specified path. */
  delete(bucket: string, path: string): Promise<void>;
  
  /** Lists files under a specific prefix. */
  list(bucket: string, prefix: string): Promise<string[]>;
}
