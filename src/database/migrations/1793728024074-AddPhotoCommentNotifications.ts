import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPhotoCommentNotifications1793728024074 implements MigrationInterface {
    name = 'AddPhotoCommentNotifications1793728024074'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`feed_photo_comment_notifications\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`recipientId\` varchar(36) NOT NULL, \`commentId\` varchar(36) NOT NULL, \`commentVersion\` int NOT NULL, \`commentText\` varchar(1000) NOT NULL, \`reason\` varchar(500) NOT NULL, \`readAt\` datetime NULL, INDEX \`IDX_photo_comment_notice_recipient_read_created\` (\`recipientId\`, \`readAt\`, \`createdAt\`), UNIQUE INDEX \`UQ_photo_comment_notice_review\` (\`commentId\`, \`commentVersion\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comment_notifications\` ADD CONSTRAINT \`FK_e65cec82fd9d15e4228c954018b\` FOREIGN KEY (\`recipientId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comment_notifications\` ADD CONSTRAINT \`FK_8509fbc05e16c701ade7c97f536\` FOREIGN KEY (\`commentId\`) REFERENCES \`feed_photo_comments\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`feed_photo_comment_notifications\` DROP FOREIGN KEY \`FK_8509fbc05e16c701ade7c97f536\``);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comment_notifications\` DROP FOREIGN KEY \`FK_e65cec82fd9d15e4228c954018b\``);
        await queryRunner.query(`DROP INDEX \`UQ_photo_comment_notice_review\` ON \`feed_photo_comment_notifications\``);
        await queryRunner.query(`DROP INDEX \`IDX_photo_comment_notice_recipient_read_created\` ON \`feed_photo_comment_notifications\``);
        await queryRunner.query(`DROP TABLE \`feed_photo_comment_notifications\``);
    }

}
