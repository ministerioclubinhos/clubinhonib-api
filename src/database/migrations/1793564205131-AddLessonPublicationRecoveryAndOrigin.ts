import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLessonPublicationRecoveryAndOrigin1793564205131 implements MigrationInterface {
    name = 'AddLessonPublicationRecoveryAndOrigin1793564205131'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`week_material_pages\` ADD \`source_lesson_id\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`week_material_pages\` ADD UNIQUE INDEX \`IDX_f36243f5be6e6ff29cdd652009\` (\`source_lesson_id\`)`);
        await queryRunner.query(`ALTER TABLE \`lessons\` ADD \`publication_lease_owner\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`lessons\` ADD \`publication_lease_until\` datetime NULL`);
        await queryRunner.query(`ALTER TABLE \`lessons\` ADD \`publication_reserved_versions_json\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`lessons\` ADD \`publication_failure_message\` varchar(500) NULL`);
        await queryRunner.query(`CREATE UNIQUE INDEX \`uq_week_material_pages_source_lesson_id\` ON \`week_material_pages\` (\`source_lesson_id\`)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX \`uq_week_material_pages_source_lesson_id\` ON \`week_material_pages\``);
        await queryRunner.query(`ALTER TABLE \`lessons\` DROP COLUMN \`publication_failure_message\``);
        await queryRunner.query(`ALTER TABLE \`lessons\` DROP COLUMN \`publication_reserved_versions_json\``);
        await queryRunner.query(`ALTER TABLE \`lessons\` DROP COLUMN \`publication_lease_until\``);
        await queryRunner.query(`ALTER TABLE \`lessons\` DROP COLUMN \`publication_lease_owner\``);
        await queryRunner.query(`ALTER TABLE \`week_material_pages\` DROP INDEX \`IDX_f36243f5be6e6ff29cdd652009\``);
        await queryRunner.query(`ALTER TABLE \`week_material_pages\` DROP COLUMN \`source_lesson_id\``);
    }

}
