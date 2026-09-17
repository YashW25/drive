"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteAuthStorageProvider = void 0;
const baileys_1 = require("@whiskeysockets/baileys");
class RemoteAuthStorageProvider {
    storage;
    bucket;
    prefix;
    constructor(storage, bucket, prefix = 'auth') {
        this.storage = storage;
        this.bucket = bucket;
        this.prefix = prefix;
    }
    getSessionPath(sessionId, file) {
        return `${this.prefix}/${sessionId}/${file}`;
    }
    async useAuthState(sessionId) {
        const credsPath = this.getSessionPath(sessionId, 'creds.json');
        const credsData = await this.storage.download(this.bucket, credsPath);
        let creds = credsData
            ? JSON.parse(credsData.toString(), baileys_1.BufferJSON.reviver)
            : (0, baileys_1.initAuthCreds)();
        const saveCreds = async () => {
            await this.storage.upload(this.bucket, credsPath, JSON.stringify(creds, baileys_1.BufferJSON.replacer, 2));
        };
        return {
            state: {
                creds,
                keys: {
                    get: async (type, ids) => {
                        const data = {};
                        await Promise.all(ids.map(async (id) => {
                            const filePath = this.getSessionPath(sessionId, `keys/${type}-${id}.json`);
                            try {
                                const value = await this.storage.download(this.bucket, filePath);
                                if (value) {
                                    data[id] = JSON.parse(value.toString(), baileys_1.BufferJSON.reviver);
                                }
                            }
                            catch (error) {
                            }
                        }));
                        return data;
                    },
                    set: async (data) => {
                        const tasks = [];
                        for (const category in data) {
                            for (const id in data[category]) {
                                const value = data[category][id];
                                const filePath = this.getSessionPath(sessionId, `keys/${category}-${id}.json`);
                                if (value) {
                                    tasks.push(this.storage.upload(this.bucket, filePath, JSON.stringify(value, baileys_1.BufferJSON.replacer, 2)));
                                }
                                else {
                                    tasks.push(this.storage.delete(this.bucket, filePath));
                                }
                            }
                        }
                        await Promise.all(tasks);
                    }
                }
            },
            saveCreds
        };
    }
    async clearAuthState(sessionId) {
        const credsPath = this.getSessionPath(sessionId, 'creds.json');
        await this.storage.delete(this.bucket, credsPath);
    }
}
exports.RemoteAuthStorageProvider = RemoteAuthStorageProvider;
//# sourceMappingURL=remote-auth-storage.provider.js.map