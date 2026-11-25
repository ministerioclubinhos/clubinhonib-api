import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPlaySubmissions1795434850193 implements MigrationInterface {
    name = 'AddPlaySubmissions1795434850193'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`play_submissions\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`submitted_by_id\` varchar(36) NULL, \`title\` varchar(255) NOT NULL, \`description\` text NOT NULL, \`upload_type\` enum ('link', 'upload') NOT NULL, \`platform_type\` enum ('youtube', 'googledrive', 'onedrive', 'dropbox', 'ANY') NULL, \`url\` varchar(1000) NOT NULL, \`original_name\` varchar(255) NULL, \`size\` bigint NULL, \`thumbnail_url\` varchar(1000) NULL, \`duration_seconds\` int NULL, \`status\` enum ('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending', \`rejection_reason\` varchar(500) NULL, \`reviewed_by_id\` varchar(36) NULL, \`reviewed_at\` datetime NULL, \`media_item_id\` varchar(36) NULL, INDEX \`IDX_play_submissions_status\` (\`status\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`play_submissions\` ADD CONSTRAINT \`FK_f370300434ece416a759242697d\` FOREIGN KEY (\`submitted_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`play_submissions\` ADD CONSTRAINT \`FK_4b84f25aacb718f74e53558d69f\` FOREIGN KEY (\`reviewed_by_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`play_submissions\` ADD CONSTRAINT \`FK_b79f6925e593b7021ac213fec8f\` FOREIGN KEY (\`media_item_id\`) REFERENCES \`media_items\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`play_submissions\` DROP FOREIGN KEY \`FK_b79f6925e593b7021ac213fec8f\``);
        await queryRunner.query(`ALTER TABLE \`play_submissions\` DROP FOREIGN KEY \`FK_4b84f25aacb718f74e53558d69f\``);
        await queryRunner.query(`ALTER TABLE \`play_submissions\` DROP FOREIGN KEY \`FK_f370300434ece416a759242697d\``);
        await queryRunner.query(`DROP INDEX \`IDX_play_submissions_status\` ON \`play_submissions\``);
        await queryRunner.query(`DROP TABLE \`play_submissions\``);
    }

}
