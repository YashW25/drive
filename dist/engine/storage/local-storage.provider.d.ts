import { IStorageProvider } from './storage.provider.interface';
export declare class LocalStorageProvider implements IStorageProvider {
    private readonly baseDir;
    constructor(baseDir?: string);
    upload(bucket: string, objectPath: string, data: string | Buffer): Promise<void>;
    download(bucket: string, objectPath: string): Promise<string | Buffer | null>;
    delete(bucket: string, objectPath: string): Promise<void>;
    list(bucket: string, prefix: string): Promise<string[]>;
}
