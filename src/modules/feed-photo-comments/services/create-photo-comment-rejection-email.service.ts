import { Injectable, Logger } from '@nestjs/common';
import { UserEntity } from 'src/core/user/entities/user.entity';
import { toEmailRecipient } from 'src/core/user/utils';
import { EmailService } from 'src/shared/email';
import { SiteUrlService } from 'src/shared/site-url';
import { PHOTO_COMMENT_FEED_PATH } from '../constants';
import { CreatePhotoCommentNotificationInput } from '../types';

@Injectable()
export class CreatePhotoCommentRejectionEmailService {
  private readonly logger = new Logger(
    CreatePhotoCommentRejectionEmailService.name,
  );
  constructor(
    private readonly email: EmailService,
    private readonly siteUrl: SiteUrlService,
  ) {}

  sendInBackground(
    author: UserEntity,
    notice: CreatePhotoCommentNotificationInput,
  ): void {
    void this.send(author, notice).catch(() => {
      this.logger.error(
        `Falha no aviso de reprovação do comentário ${notice.commentId}.`,
      );
    });
  }

  private async send(
    author: UserEntity,
    notice: CreatePhotoCommentNotificationInput,
  ): Promise<void> {
    await this.email.sendFeedPhotoCommentRejected(toEmailRecipient(author), {
      recipientName: author.name,
      commentText: notice.commentText,
      reason: notice.reason,
      feedLink: this.siteUrl.buildUrl(PHOTO_COMMENT_FEED_PATH),
    });
  }
}
