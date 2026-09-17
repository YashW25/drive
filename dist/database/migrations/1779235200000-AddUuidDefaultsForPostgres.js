"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddUuidDefaultsForPostgres1779235200000 = void 0;
class AddUuidDefaultsForPostgres1779235200000 {
    name = 'AddUuidDefaultsForPostgres1779235200000';
    tables = ['sessions', 'webhooks', 'messages', 'message_batches'];
    async up(queryRunner) {
        if (queryRunner.connection.options.type !== 'postgres')
            return;
        for (const table of this.tables) {
            const exists = await queryRunner.hasTable(table);
            if (!exists)
                continue;
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::varchar`);
        }
    }
    async down(queryRunner) {
        if (queryRunner.connection.options.type !== 'postgres')
            return;
        for (const table of this.tables) {
            const exists = await queryRunner.hasTable(table);
            if (!exists)
                continue;
            await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "id" DROP DEFAULT`);
        }
    }
}
exports.AddUuidDefaultsForPostgres1779235200000 = AddUuidDefaultsForPostgres1779235200000;
//# sourceMappingURL=1779235200000-AddUuidDefaultsForPostgres.js.map