import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdeaAiTargetedRegeneration1794524531633 implements MigrationInterface {
    name = 'AddIdeaAiTargetedRegeneration1794524531633'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`scope\` enum ('FULL', 'TEXT', 'MEDIA', 'FAILED') NOT NULL DEFAULT 'FULL'`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`include_text\` tinyint NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`target_media_ids\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`base_enhancement_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`instructions\` varchar(500) NULL`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`claim_count\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`progress_total\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` ADD \`progress_done\` int NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` ADD \`error_code\` enum ('PROVIDER_NOT_CONFIGURED', 'PROVIDER_REQUEST_FAILED', 'INVALID_PROVIDER_RESPONSE', 'GUARD_REJECTED', 'LIMIT_REACHED', 'CANCELLED', 'STALLED', 'SNAPSHOT_MISSING', 'QUEUE_UNAVAILABLE') NULL`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` ADD \`carried_over\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_publication_choices\` ADD \`edited\` tinyint NOT NULL DEFAULT 0`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` CHANGE \`error_code\` \`error_code\` enum ('PROVIDER_NOT_CONFIGURED', 'PROVIDER_REQUEST_FAILED', 'INVALID_PROVIDER_RESPONSE', 'GUARD_REJECTED', 'LIMIT_REACHED', 'CANCELLED', 'STALLED', 'SNAPSHOT_MISSING', 'QUEUE_UNAVAILABLE') NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` CHANGE \`error_code\` \`error_code\` enum ('PROVIDER_NOT_CONFIGURED', 'PROVIDER_REQUEST_FAILED', 'INVALID_PROVIDER_RESPONSE', 'GUARD_REJECTED', 'LIMIT_REACHED', 'CANCELLED') NULL`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_publication_choices\` DROP COLUMN \`edited\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` DROP COLUMN \`carried_over\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` DROP COLUMN \`error_code\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`progress_done\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`progress_total\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`claim_count\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`instructions\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`base_enhancement_id\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`target_media_ids\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`include_text\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_enhancements\` DROP COLUMN \`scope\``);
    }

}
