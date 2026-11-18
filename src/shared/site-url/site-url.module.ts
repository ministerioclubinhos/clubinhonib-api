import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SiteUrlService } from './site-url.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SiteUrlService],
  exports: [SiteUrlService],
})
export class SiteUrlModule {}
