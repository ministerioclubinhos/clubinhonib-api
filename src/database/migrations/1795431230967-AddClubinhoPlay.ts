import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClubinhoPlay1795431230967 implements MigrationInterface {
    name = 'AddClubinhoPlay1795431230967'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`play_video_entries\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`videos_page_id\` varchar(36) NOT NULL, \`media_item_id\` varchar(36) NOT NULL, \`featured\` tinyint NOT NULL DEFAULT 0, \`position\` int NULL, \`thumbnail_url\` varchar(1000) NULL, \`duration_seconds\` int NULL, UNIQUE INDEX \`UQ_play_video_entries_media_item\` (\`media_item_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`videos_pages\` ADD \`play_scope\` enum ('none', 'all', 'selected') NOT NULL DEFAULT 'none'`);
        await queryRunner.query(`ALTER TABLE \`play_video_entries\` ADD CONSTRAINT \`FK_d5c26f0dbccc17700f52c4ffd2a\` FOREIGN KEY (\`videos_page_id\`) REFERENCES \`videos_pages\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`play_video_entries\` ADD CONSTRAINT \`FK_2177b224577ecf4711e0216726b\` FOREIGN KEY (\`media_item_id\`) REFERENCES \`media_items\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`play_video_entries\` DROP FOREIGN KEY \`FK_2177b224577ecf4711e0216726b\``);
        await queryRunner.query(`ALTER TABLE \`play_video_entries\` DROP FOREIGN KEY \`FK_d5c26f0dbccc17700f52c4ffd2a\``);
        await queryRunner.query(`ALTER TABLE \`videos_pages\` DROP COLUMN \`play_scope\``);
        await queryRunner.query(`DROP INDEX \`UQ_play_video_entries_media_item\` ON \`play_video_entries\``);
        await queryRunner.query(`DROP TABLE \`play_video_entries\``);
    }

}
