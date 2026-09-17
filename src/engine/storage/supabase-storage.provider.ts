import { IStorageProvider } from './storage.provider.interface';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class SupabaseStorageProvider implements IStorageProvider {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    }
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  async upload(bucket: string, path: string, data: string | Buffer): Promise<void> {
    const buffer = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data;
    const { error } = await this.supabase
      .storage
      .from(bucket)
      .upload(path, buffer, {
        upsert: true,
        contentType: typeof data === 'string' ? 'text/plain' : 'application/octet-stream',
      });
    if (error) {
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }
  }

  async download(bucket: string, path: string): Promise<string | Buffer | null> {
    const { data, error } = await this.supabase
      .storage
      .from(bucket)
      .download(path);
      
    if (error) {
      // Return null if not found
      if (error.message.includes('not found') || error.message.includes('NoSuchKey') || error.message.includes('Object not found')) {
        return null;
      }
      throw new Error(`Failed to download from Supabase: ${error.message}`);
    }
    
    if (!data) return null;
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(bucket: string, path: string): Promise<void> {
    const { error } = await this.supabase
      .storage
      .from(bucket)
      .remove([path]);
      
    if (error) {
      throw new Error(`Failed to delete from Supabase: ${error.message}`);
    }
  }

  async list(bucket: string, prefix: string): Promise<string[]> {
    const { data, error } = await this.supabase
      .storage
      .from(bucket)
      .list(prefix);
      
    if (error) {
      throw new Error(`Failed to list from Supabase: ${error.message}`);
    }
    
    return data.map(item => item.name);
  }
}
