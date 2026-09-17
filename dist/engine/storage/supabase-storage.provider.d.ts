import { IStorageProvider } from './storage.provider.interface';
export declare class SupabaseStorageProvider implements IStorageProvider {
    private supabase;
    constructor();
    upload(bucket: string, path: string, data: string | Buffer): Promise<void>;
    download(bucket: string, path: string): Promise<string | Buffer | null>;
    delete(bucket: string, path: string): Promise<void>;
    list(bucket: string, prefix: string): Promise<string[]>;
}
