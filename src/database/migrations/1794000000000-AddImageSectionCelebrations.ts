import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddImageSectionCelebrations1794000000000 implements MigrationInterface {
  name = 'AddImageSectionCelebrations1794000000000';
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE \`image_section_celebrations\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`sectionId\` varchar(36) NULL, \`userId\` varchar(36) NULL, UNIQUE INDEX \`IDX_image_celebration_pair\` (\`sectionId\`, \`userId\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
    await queryRunner.query(`ALTER TABLE \`image_section_celebrations\` ADD CONSTRAINT \`FK_isc_section\` FOREIGN KEY (\`sectionId\`) REFERENCES \`image_sections\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    await queryRunner.query(`ALTER TABLE \`image_section_celebrations\` ADD CONSTRAINT \`FK_isc_user\` FOREIGN KEY (\`userId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `image_section_celebrations` DROP FOREIGN KEY `FK_isc_user`');
    await queryRunner.query('ALTER TABLE `image_section_celebrations` DROP FOREIGN KEY `FK_isc_section`');
    await queryRunner.query('DROP TABLE `image_section_celebrations`');
  }
}
