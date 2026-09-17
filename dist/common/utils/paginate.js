"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LIST_LIMIT = void 0;
exports.paginate = paginate;
exports.DEFAULT_LIST_LIMIT = 1000;
function paginate(items, limit, offset) {
    const off = typeof offset === 'number' && Number.isFinite(offset) ? Math.max(Math.trunc(offset), 0) : 0;
    const lim = typeof limit === 'number' && Number.isFinite(limit)
        ? Math.min(Math.max(Math.trunc(limit), 1), exports.DEFAULT_LIST_LIMIT)
        : exports.DEFAULT_LIST_LIMIT;
    return items.slice(off, off + lim);
}
//# sourceMappingURL=paginate.js.map