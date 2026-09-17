"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3StorageProvider = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
class S3StorageProvider {
    s3;
    constructor() {
        this.s3 = new client_s3_1.S3Client({
            region: process.env.S3_REGION || 'us-east-1',
            endpoint: process.env.S3_ENDPOINT,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
            },
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
        });
    }
    async upload(bucket, path, data) {
        const command = new client_s3_1.PutObjectCommand({
            Bucket: bucket,
            Key: path,
            Body: typeof data === 'string' ? Buffer.from(data, 'utf-8') : data,
            ContentType: typeof data === 'string' ? 'text/plain' : 'application/octet-stream',
        });
        await this.s3.send(command);
    }
    async download(bucket, path) {
        const command = new client_s3_1.GetObjectCommand({
            Bucket: bucket,
            Key: path,
        });
        try {
            const response = await this.s3.send(command);
            if (!response.Body)
                return null;
            const stream = response.Body;
            return new Promise((resolve, reject) => {
                const chunks = [];
                stream.on('data', chunk => chunks.push(chunk));
                stream.on('error', reject);
                stream.on('end', () => resolve(Buffer.concat(chunks)));
            });
        }
        catch (err) {
            if (err.name === 'NoSuchKey' || err.name === 'NotFound') {
                return null;
            }
            throw err;
        }
    }
    async delete(bucket, path) {
        const command = new client_s3_1.DeleteObjectCommand({
            Bucket: bucket,
            Key: path,
        });
        await this.s3.send(command);
    }
    async list(bucket, prefix) {
        const command = new client_s3_1.ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
        });
        const response = await this.s3.send(command);
        return response.Contents?.map(item => item.Key).filter(Boolean) || [];
    }
}
exports.S3StorageProvider = S3StorageProvider;
//# sourceMappingURL=s3-storage.provider.js.map