import { MigrationInterface, QueryRunner } from "typeorm";

export class  $npmConfigName1782582131246 implements MigrationInterface {
    name = ' $npmConfigName1782582131246'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "supabaseId" varchar NOT NULL, "email" varchar(255), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_46a570d4ae0901b4971840999ed" UNIQUE ("supabaseId"))`);
        await queryRunner.query(`DROP INDEX "IDX_df3b25181df0b4b59bd93f16e1"`);
        await queryRunner.query(`CREATE TABLE "temporary_api_keys" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "keyHash" varchar(64) NOT NULL, "keyPrefix" varchar(12) NOT NULL, "role" varchar(20) NOT NULL DEFAULT ('operator'), "allowedIps" text, "allowedSessions" text, "isActive" boolean NOT NULL DEFAULT (1), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" varchar)`);
        await queryRunner.query(`INSERT INTO "temporary_api_keys"("id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt") SELECT "id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt" FROM "api_keys"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`ALTER TABLE "temporary_api_keys" RENAME TO "api_keys"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash") `);
        await queryRunner.query(`DROP INDEX "IDX_df3b25181df0b4b59bd93f16e1"`);
        await queryRunner.query(`CREATE TABLE "temporary_api_keys" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "keyHash" varchar(64) NOT NULL, "keyPrefix" varchar(12) NOT NULL, "role" varchar(20) NOT NULL DEFAULT ('operator'), "allowedIps" text, "allowedSessions" text, "isActive" boolean NOT NULL DEFAULT (1), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" varchar, CONSTRAINT "FK_6c2e267ae764a9413b863a29342" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_api_keys"("id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt", "userId") SELECT "id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt", "userId" FROM "api_keys"`);
        await queryRunner.query(`DROP TABLE "api_keys"`);
        await queryRunner.query(`ALTER TABLE "temporary_api_keys" RENAME TO "api_keys"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_df3b25181df0b4b59bd93f16e1"`);
        await queryRunner.query(`ALTER TABLE "api_keys" RENAME TO "temporary_api_keys"`);
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "keyHash" varchar(64) NOT NULL, "keyPrefix" varchar(12) NOT NULL, "role" varchar(20) NOT NULL DEFAULT ('operator'), "allowedIps" text, "allowedSessions" text, "isActive" boolean NOT NULL DEFAULT (1), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), "userId" varchar)`);
        await queryRunner.query(`INSERT INTO "api_keys"("id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt", "userId") SELECT "id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt", "userId" FROM "temporary_api_keys"`);
        await queryRunner.query(`DROP TABLE "temporary_api_keys"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash") `);
        await queryRunner.query(`DROP INDEX "IDX_df3b25181df0b4b59bd93f16e1"`);
        await queryRunner.query(`ALTER TABLE "api_keys" RENAME TO "temporary_api_keys"`);
        await queryRunner.query(`CREATE TABLE "api_keys" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(100) NOT NULL, "keyHash" varchar(64) NOT NULL, "keyPrefix" varchar(12) NOT NULL, "role" varchar(20) NOT NULL DEFAULT ('operator'), "allowedIps" text, "allowedSessions" text, "isActive" boolean NOT NULL DEFAULT (1), "expiresAt" datetime, "lastUsedAt" datetime, "usageCount" integer NOT NULL DEFAULT (0), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "api_keys"("id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt") SELECT "id", "name", "keyHash", "keyPrefix", "role", "allowedIps", "allowedSessions", "isActive", "expiresAt", "lastUsedAt", "usageCount", "createdAt", "updatedAt" FROM "temporary_api_keys"`);
        await queryRunner.query(`DROP TABLE "temporary_api_keys"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_df3b25181df0b4b59bd93f16e1" ON "api_keys" ("keyHash") `);
        await queryRunner.query(`DROP TABLE "users"`);
    }

}
