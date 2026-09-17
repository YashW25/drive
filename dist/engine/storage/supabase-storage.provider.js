"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseStorageProvider = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
class SupabaseStorageProvider {
    supabase;
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    async upload(bucket, path, data) {
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
    async download(bucket, path) {
        const { data, error } = await this.supabase
            .storage
            .from(bucket)
            .download(path);
        if (error) {
            if (error.message.includes('not found') || error.message.includes('NoSuchKey') || error.message.includes('Object not found')) {
                return null;
            }
            throw new Error(`Failed to download from Supabase: ${error.message}`);
        }
        if (!data)
            return null;
        const arrayBuffer = await data.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    async delete(bucket, path) {
        const { error } = await this.supabase
            .storage
            .from(bucket)
            .remove([path]);
        if (error) {
            throw new Error(`Failed to delete from Supabase: ${error.message}`);
        }
    }
    async list(bucket, prefix) {
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
exports.SupabaseStorageProvider = SupabaseStorageProvider;
//# sourceMappingURL=supabase-storage.provider.js.map