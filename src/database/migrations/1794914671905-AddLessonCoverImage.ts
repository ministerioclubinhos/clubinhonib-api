import { MigrationInterface, QueryRunner } from "typeorm";

export class AddLessonCoverImage1794914671905 implements MigrationInterface {
    name = 'AddLessonCoverImage1794914671905'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lessons\` ADD \`cover_image_url\` varchar(1000) NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`lessons\` DROP COLUMN \`cover_image_url\``);
    }

}
