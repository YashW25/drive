import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSessionOwner1782582172365 implements MigrationInterface {
    name = 'AddSessionOwner1782582172365'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Just add ownerSupabaseId to sessions
        await queryRunner.query(`ALTER TABLE "sessions" ADD COLUMN "ownerSupabaseId" varchar(255)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // SQLite does not support drop column directly, but we don't need a strict down migration for this step.
    }
}
