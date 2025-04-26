import { Module } from '@nestjs/common';
import { DocumentPageController } from './document-page.controller';
import { DocumentPageService } from './document-page.service';

@Module({
  controllers: [DocumentPageController],
  providers: [DocumentPageService]
})
export class DocumentPageModule {}
