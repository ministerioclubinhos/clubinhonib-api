import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SmtpModule } from 'src/shared/providers/smtp/smtp.module';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, SmtpModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
