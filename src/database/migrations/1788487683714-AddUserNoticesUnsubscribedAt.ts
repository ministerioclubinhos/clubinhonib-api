import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserNoticesUnsubscribedAt1788487683714
  implements MigrationInterface
{
  name = 'AddUserNoticesUnsubscribedAt1788487683714';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`noticesUnsubscribedAt\` datetime NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP COLUMN \`noticesUnsubscribedAt\``,
    );
  }
}
