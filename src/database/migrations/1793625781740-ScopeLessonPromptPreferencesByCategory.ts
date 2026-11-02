import { MigrationInterface, QueryRunner } from "typeorm";

export class ScopeLessonPromptPreferencesByCategory1793625781740 implements MigrationInterface {
    name = 'ScopeLessonPromptPreferencesByCategory1793625781740'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX \`uq_admin_lesson_prompt_stage\` ON \`admin_lesson_prompts\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`admin_lesson_prompts\`
            ADD \`category\` enum ('REGULAR', 'SPECIAL') NOT NULL DEFAULT 'REGULAR'
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_admin_lesson_prompt_stage\` ON \`admin_lesson_prompts\` (\`admin_id\`, \`category\`, \`stage\`)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DROP INDEX \`uq_admin_lesson_prompt_stage\` ON \`admin_lesson_prompts\`
        `);
        await queryRunner.query(`
            ALTER TABLE \`admin_lesson_prompts\` DROP COLUMN \`category\`
        `);
        await queryRunner.query(`
            CREATE UNIQUE INDEX \`uq_admin_lesson_prompt_stage\` ON \`admin_lesson_prompts\` (\`admin_id\`, \`stage\`)
        `);
    }

}
