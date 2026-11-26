import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFeedPhotoComments1793668750274 implements MigrationInterface {
    name = 'AddFeedPhotoComments1793668750274'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`feed_photo_comments\` (\`id\` varchar(36) NOT NULL, \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updatedAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`mediaId\` varchar(36) NOT NULL, \`authorId\` varchar(36) NOT NULL, \`requestId\` varchar(36) NOT NULL, \`text\` varchar(1000) NOT NULL, \`status\` enum ('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending', \`moderationReason\` varchar(500) NULL, \`moderatedById\` varchar(36) NULL, \`reviewedAt\` datetime NULL, \`version\` int NOT NULL, UNIQUE INDEX \`UQ_feed_photo_comments_author_request\` (\`authorId\`, \`requestId\`), INDEX \`IDX_feed_photo_comments_author_created\` (\`authorId\`, \`createdAt\`), INDEX \`IDX_feed_photo_comments_status_created\` (\`status\`, \`createdAt\`), INDEX \`IDX_feed_photo_comments_media_status_created\` (\`mediaId\`, \`status\`, \`createdAt\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comments\` ADD CONSTRAINT \`FK_2ccb8db5eb775f4aad6a553199e\` FOREIGN KEY (\`mediaId\`) REFERENCES \`media_items\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comments\` ADD CONSTRAINT \`FK_3b0097e35196bc4d8680d76a6ad\` FOREIGN KEY (\`authorId\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comments\` ADD CONSTRAINT \`FK_c769de41984e19151f9e5e337e4\` FOREIGN KEY (\`moderatedById\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`feed_photo_comments\` DROP FOREIGN KEY \`FK_c769de41984e19151f9e5e337e4\``);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comments\` DROP FOREIGN KEY \`FK_3b0097e35196bc4d8680d76a6ad\``);
        await queryRunner.query(`ALTER TABLE \`feed_photo_comments\` DROP FOREIGN KEY \`FK_2ccb8db5eb775f4aad6a553199e\``);
        await queryRunner.query(`DROP INDEX \`IDX_feed_photo_comments_media_status_created\` ON \`feed_photo_comments\``);
        await queryRunner.query(`DROP INDEX \`IDX_feed_photo_comments_status_created\` ON \`feed_photo_comments\``);
        await queryRunner.query(`DROP INDEX \`IDX_feed_photo_comments_author_created\` ON \`feed_photo_comments\``);
        await queryRunner.query(`DROP INDEX \`UQ_feed_photo_comments_author_request\` ON \`feed_photo_comments\``);
        await queryRunner.query(`DROP TABLE \`feed_photo_comments\``);
    }

}
