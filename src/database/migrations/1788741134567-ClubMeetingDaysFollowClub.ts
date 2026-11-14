import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClubMeetingDaysFollowClub1788741134567
  implements MigrationInterface
{
  name = 'ClubMeetingDaysFollowClub1788741134567';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP FOREIGN KEY \`FK_d54bb512a9336aa807b92d4505a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP COLUMN \`recurrence_end_date\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD CONSTRAINT \`FK_d54bb512a9336aa807b92d4505a\` FOREIGN KEY (\`club_id\`) REFERENCES \`clubs\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`events\` DROP FOREIGN KEY \`FK_d54bb512a9336aa807b92d4505a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD \`recurrence_end_date\` date NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE \`events\` ADD CONSTRAINT \`FK_d54bb512a9336aa807b92d4505a\` FOREIGN KEY (\`club_id\`) REFERENCES \`clubs\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
