import { MigrationInterface, QueryRunner } from "typeorm";

export class AddClubinhoMediaAuthor1793841264523 implements MigrationInterface {
    name = 'AddClubinhoMediaAuthor1793841264523'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`image_sections\` ADD \`authorId\` varchar(36) NULL`);
        await queryRunner.query(`ALTER TABLE \`image_sections\` ADD CONSTRAINT \`FK_e530e3c1c69be7f533a8d23c2cd\` FOREIGN KEY (\`authorId\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`image_sections\` DROP FOREIGN KEY \`FK_e530e3c1c69be7f533a8d23c2cd\``);
        await queryRunner.query(`ALTER TABLE \`image_sections\` DROP COLUMN \`authorId\``);
    }

}
