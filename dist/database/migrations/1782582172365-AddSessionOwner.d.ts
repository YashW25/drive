import { MigrationInterface, QueryRunner } from "typeorm";
export declare class AddSessionOwner1782582172365 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
