import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdeaAiEditableDocument1794786458731 implements MigrationInterface {
    name = 'AddIdeaAiEditableDocument1794786458731'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` ADD \`editable_document_json\` json NULL`);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` ADD \`document_edited_at\` datetime NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` DROP COLUMN \`document_edited_at\``);
        await queryRunner.query(`ALTER TABLE \`ideas_section_ai_media_enhancements\` DROP COLUMN \`editable_document_json\``);
    }

}
