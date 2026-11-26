import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from 'src/shared/email';
import { UserModule } from 'src/core/user/user.module';
import { NotificationService } from './notification.service';

@Global()
@Module({
  imports: [ConfigModule, EmailModule, UserModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
