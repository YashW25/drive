"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddSessionOwner1782582172365 = void 0;
class AddSessionOwner1782582172365 {
    name = 'AddSessionOwner1782582172365';
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN "ownerSupabaseId" varchar(255)`);
    }
    async down(queryRunner) {
    }
}
exports.AddSessionOwner1782582172365 = AddSessionOwner1782582172365;
//# sourceMappingURL=1782582172365-AddSessionOwner.js.map