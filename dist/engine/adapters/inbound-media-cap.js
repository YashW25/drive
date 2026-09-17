"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inboundMediaMaxBytes = inboundMediaMaxBytes;
exports.inboundMediaConcurrency = inboundMediaConcurrency;
exports.coerceDeclaredSize = coerceDeclaredSize;
exports.capInboundMedia = capInboundMedia;
const DEFAULT_INBOUND_MEDIA_MAX_BYTES = 50 * 1024 * 1024;
function inboundMediaMaxBytes() {
    const parsed = Number.parseInt(process.env.MEDIA_DOWNLOAD_MAX_BYTES ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INBOUND_MEDIA_MAX_BYTES;
}
const DEFAULT_INBOUND_MEDIA_CONCURRENCY = 4;
function inboundMediaConcurrency() {
    const parsed = Number.parseInt(process.env.INBOUND_MEDIA_CONCURRENCY ?? '', 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : DEFAULT_INBOUND_MEDIA_CONCURRENCY;
}
function coerceDeclaredSize(value) {
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : 0;
    if (value && typeof value.toNumber === 'function') {
        const n = value.toNumber();
        return Number.isFinite(n) ? n : 0;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}
function capInboundMedia(args) {
    const max = args.maxBytes ?? inboundMediaMaxBytes();
    if (args.sizeBytes > max) {
        return { mimetype: args.mimetype, filename: args.filename, omitted: true, sizeBytes: args.sizeBytes };
    }
    return { mimetype: args.mimetype, filename: args.filename, data: args.toBase64() };
}
//# sourceMappingURL=inbound-media-cap.js.map