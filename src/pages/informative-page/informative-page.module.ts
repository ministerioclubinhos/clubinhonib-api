import { Module } from '@nestjs/common';
import { InformativePageController } from './informative-page.controller';
import { InformativePageService } from './informative-page.service';

@Module({
  controllers: [InformativePageController],
  providers: [InformativePageService]
})
export class InformativePageModule {}
