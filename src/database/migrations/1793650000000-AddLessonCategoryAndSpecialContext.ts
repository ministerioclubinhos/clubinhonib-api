import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLessonCategoryAndSpecialContext1793650000000
  implements MigrationInterface
{
  name = 'AddLessonCategoryAndSpecialContext1793650000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lessons\` ADD \`category\` enum ('REGULAR', 'SPECIAL') NOT NULL DEFAULT 'REGULAR'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`lessons\` ADD \`special_context\` text NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lessons\` DROP COLUMN \`special_context\``,
    );
    await queryRunner.query(`ALTER TABLE \`lessons\` DROP COLUMN \`category\``);
  }
}
