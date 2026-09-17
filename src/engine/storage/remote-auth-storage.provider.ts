import { IAuthStorageProvider } from './auth-storage.interface';
import { IStorageProvider } from './storage.provider.interface';
import { AuthenticationState, BufferJSON, initAuthCreds, SignalDataTypeMap } from '@whiskeysockets/baileys';

export class RemoteAuthStorageProvider implements IAuthStorageProvider {
  constructor(
    private readonly storage: IStorageProvider,
    private readonly bucket: string,
    private readonly prefix: string = 'auth'
  ) {}

  private getSessionPath(sessionId: string, file: string): string {
    return `${this.prefix}/${sessionId}/${file}`;
  }

  async useAuthState(sessionId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
    const credsPath = this.getSessionPath(sessionId, 'creds.json');
    
    // Load creds
    const credsData = await this.storage.download(this.bucket, credsPath);
    let creds = credsData 
      ? JSON.parse(credsData.toString(), BufferJSON.reviver)
      : initAuthCreds();

    const saveCreds = async () => {
      await this.storage.upload(
        this.bucket, 
        credsPath, 
        JSON.stringify(creds, BufferJSON.replacer, 2)
      );
    };

    return {
      state: {
        creds,
        keys: {
          get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
            const data: { [id: string]: any } = {};
            await Promise.all(
              ids.map(async id => {
                const filePath = this.getSessionPath(sessionId, `keys/${type}-${id}.json`);
                try {
                  const value = await this.storage.download(this.bucket, filePath);
                  if (value) {
                    data[id] = JSON.parse(value.toString(), BufferJSON.reviver);
                  }
                } catch (error) {
                  // If it fails to fetch, just treat it as not found
                }
              })
            );
            return data;
          },
          set: async (data: any) => {
            const tasks: Promise<void>[] = [];
            for (const category in data) {
              for (const id in data[category]) {
                const value = data[category][id];
                const filePath = this.getSessionPath(sessionId, `keys/${category}-${id}.json`);
                if (value) {
                  tasks.push(
                    this.storage.upload(
                      this.bucket,
                      filePath,
                      JSON.stringify(value, BufferJSON.replacer, 2)
                    )
                  );
                } else {
                  tasks.push(
                    this.storage.delete(this.bucket, filePath)
                  );
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

  async clearAuthState(sessionId: string): Promise<void> {
    // We can list and delete all files, but list might be tricky depending on the provider.
    // For now, we will delete creds.json at minimum. A proper provider would need a bulk delete.
    const credsPath = this.getSessionPath(sessionId, 'creds.json');
    await this.storage.delete(this.bucket, credsPath);
  }
}
