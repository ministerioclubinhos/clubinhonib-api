import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class PersistAiLessonGenerationJobs1790467200000
  implements MigrationInterface
{
  name = 'PersistAiLessonGenerationJobs1790467200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns = [
      new TableColumn({
        name: 'generation_request_json',
        type: 'json',
        isNullable: true,
      }),
      new TableColumn({
        name: 'generation_requested_by_id',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
      new TableColumn({
        name: 'generation_lease_owner',
        type: 'varchar',
        length: '36',
        isNullable: true,
      }),
      new TableColumn({
        name: 'generation_lease_until',
        type: 'datetime',
        isNullable: true,
      }),
    ];
    for (const column of columns) {
      if (!(await queryRunner.hasColumn('lesson_stages', column.name)))
        await queryRunner.addColumn('lesson_stages', column);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const name of [
      'generation_lease_until',
      'generation_lease_owner',
      'generation_requested_by_id',
      'generation_request_json',
    ]) {
      if (await queryRunner.hasColumn('lesson_stages', name))
        await queryRunner.dropColumn('lesson_stages', name);
    }
  }
}
