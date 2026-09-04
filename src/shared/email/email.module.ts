import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmtpModule } from 'src/shared/providers/smtp/smtp.module';
import { SiteUrlModule } from 'src/shared/site-url/site-url.module';
import { EmailService } from './email.service';
import { UnsubscribeTokenService } from './unsubscribe-token.service';

@Module({
  imports: [ConfigModule, SmtpModule, SiteUrlModule],
  providers: [EmailService, UnsubscribeTokenService],
  exports: [EmailService, UnsubscribeTokenService],
})
export class EmailModule {}
