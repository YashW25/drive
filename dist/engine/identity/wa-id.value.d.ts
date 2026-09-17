import { userPart, WaIdKind } from './wa-id';
export declare class WaId {
    readonly kind: WaIdKind;
    readonly raw: string;
    readonly phone?: string | undefined;
    readonly lid?: string | undefined;
    readonly groupId?: string | undefined;
    private constructor();
    static fromEngineJid(jid: string, resolvePhone?: (jid: string) => string | null): WaId;
    static fromUserInput(value: string): WaId;
    toNeutral(): string;
    toString(): string;
    toJSON(): string;
    refersToSamePerson(other: WaId): boolean | null;
}
export type { WaIdKind };
export { userPart };
