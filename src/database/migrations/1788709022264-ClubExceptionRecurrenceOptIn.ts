import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClubExceptionRecurrenceOptIn1788709022264
  implements MigrationInterface
{
  name = 'ClubExceptionRecurrenceOptIn1788709022264';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`weekday_exceptions\` CHANGE \`isRecurrent\` \`isRecurrent\` tinyint NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`weekday_exceptions\` CHANGE \`isRecurrent\` \`isRecurrent\` tinyint NOT NULL DEFAULT '1'`,
    );
  }
}
