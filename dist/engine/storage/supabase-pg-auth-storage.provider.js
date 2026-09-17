"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabasePgAuthStorageProvider = void 0;
const baileys_1 = require("@whiskeysockets/baileys");
const supabase_js_1 = require("@supabase/supabase-js");
const common_1 = require("@nestjs/common");
class SupabasePgAuthStorageProvider {
    supabase;
    logger = new common_1.Logger(SupabasePgAuthStorageProvider.name);
    constructor() {
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Supabase configuration missing (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
        }
        this.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseKey);
    }
    async useAuthState(sessionId) {
        const { data: credsData, error: credsError } = await this.supabase
            .from('baileys_auth')
            .select('value')
            .eq('session_id', sessionId)
            .eq('id', 'creds.json')
            .maybeSingle();
        if (credsError) {
            this.logger.error(`Error loading creds for session ${sessionId}: ${credsError.message}`);
        }
        let creds = credsData?.value
            ? JSON.parse(credsData.value, baileys_1.BufferJSON.reviver)
            : (0, baileys_1.initAuthCreds)();
        const saveCreds = async () => {
            const { error } = await this.supabase.from('baileys_auth').upsert({
                session_id: sessionId,
                id: 'creds.json',
                value: JSON.stringify(creds, baileys_1.BufferJSON.replacer)
            }, { onConflict: 'session_id, id' });
            if (error) {
                this.logger.error(`Error saving creds for session ${sessionId}: ${error.message}`);
            }
        };
        return {
            state: {
                creds,
                keys: {
                    get: async (type, ids) => {
                        const data = {};
                        const keyIds = ids.map(id => `keys/${type}-${id}.json`);
                        const { data: keysData, error } = await this.supabase
                            .from('baileys_auth')
                            .select('id, value')
                            .eq('session_id', sessionId)
                            .in('id', keyIds);
                        if (error) {
                            this.logger.error(`Error getting keys for session ${sessionId}: ${error.message}`);
                            return data;
                        }
                        if (keysData) {
                            for (const row of keysData) {
                                const id = row.id.split('-').slice(1).join('-').replace('.json', '');
                                data[id] = JSON.parse(row.value, baileys_1.BufferJSON.reviver);
                            }
                        }
                        return data;
                    },
                    set: async (data) => {
                        const upserts = [];
                        const deletes = [];
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id];
                                const keyId = `keys/${category}-${id}.json`;
                                if (value) {
                                    upserts.push({
                                        session_id: sessionId,
                                        id: keyId,
                                        value: JSON.stringify(value, baileys_1.BufferJSON.replacer)
                                    });
                                }
                                else {
                                    deletes.push(keyId);
                                }
                            }
                        }
                        if (upserts.length > 0) {
                            const { error } = await this.supabase.from('baileys_auth').upsert(upserts, { onConflict: 'session_id, id' });
                            if (error) {
                                this.logger.error(`Error upserting keys for session ${sessionId}: ${error.message}`);
                            }
                        }
                        if (deletes.length > 0) {
                            const { error } = await this.supabase.from('baileys_auth').delete().eq('session_id', sessionId).in('id', deletes);
                            if (error) {
                                this.logger.error(`Error deleting keys for session ${sessionId}: ${error.message}`);
                            }
                        }
                    }
                }
            },
            saveCreds
        };
    }
    async clearAuthState(sessionId) {
        const { error } = await this.supabase.from('baileys_auth').delete().eq('session_id', sessionId);
        if (error) {
            this.logger.error(`Error clearing auth state for session ${sessionId}: ${error.message}`);
        }
    }
}
exports.SupabasePgAuthStorageProvider = SupabasePgAuthStorageProvider;
//# sourceMappingURL=supabase-pg-auth-storage.provider.js.map