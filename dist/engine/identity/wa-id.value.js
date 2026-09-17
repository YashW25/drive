"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userPart = exports.WaId = void 0;
const wa_id_1 = require("./wa-id");
Object.defineProperty(exports, "userPart", { enumerable: true, get: function () { return wa_id_1.userPart; } });
class WaId {
    kind;
    raw;
    phone;
    lid;
    groupId;
    constructor(kind, raw, phone, lid, groupId) {
        this.kind = kind;
        this.raw = raw;
        this.phone = phone;
        this.lid = lid;
        this.groupId = groupId;
    }
    static fromEngineJid(jid, resolvePhone) {
        const parsed = (0, wa_id_1.parseWaId)(jid);
        switch (parsed.kind) {
            case 'user':
                return new WaId('user', jid, parsed.userPart);
            case 'group':
                return new WaId('group', jid, undefined, undefined, parsed.userPart);
            case 'lid': {
                const phone = resolvePhone?.(jid) ?? undefined;
                return new WaId('lid', jid, phone, parsed.userPart);
            }
            default:
                return new WaId(parsed.kind, jid);
        }
    }
    static fromUserInput(value) {
        const trimmed = value.trim();
        if (trimmed && !trimmed.includes('@')) {
            const digits = trimmed.replace(/\D/g, '');
            return new WaId('user', trimmed, digits || trimmed);
        }
        return WaId.fromEngineJid(trimmed);
    }
    toNeutral() {
        switch (this.kind) {
            case 'user':
                return `${this.phone}@c.us`;
            case 'group':
                return `${this.groupId}@g.us`;
            case 'lid':
                return this.phone ? `${this.phone}@c.us` : `${this.lid}@lid`;
            case 'status':
                return 'status@broadcast';
            case 'newsletter':
                return `${(0, wa_id_1.userPart)(this.raw)}@newsletter`;
            case 'broadcast':
                return `${(0, wa_id_1.userPart)(this.raw)}@broadcast`;
            default:
                return this.raw;
        }
    }
    toString() {
        return this.toNeutral();
    }
    toJSON() {
        return this.toNeutral();
    }
    refersToSamePerson(other) {
        if (this.lid && other.lid) {
            return this.lid === other.lid;
        }
        if (this.phone && other.phone) {
            return this.phone === other.phone;
        }
        return null;
    }
}
exports.WaId = WaId;
//# sourceMappingURL=wa-id.value.js.map