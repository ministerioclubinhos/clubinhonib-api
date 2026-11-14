import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentEntity } from './entities/document.entity';
import { MediaModule } from 'src/shared/media/media.module';

import { CreateDocumentService } from './services/create-document.service';
import { AnnounceDocumentService } from './services/announce-document.service';
import { EmailModule } from 'src/shared/email';
import { SiteUrlModule } from 'src/shared/site-url';
import { UserModule } from 'src/core/user/user.module';
import { UpdateDocumentService } from './services/update-document.service';
import { GetDocumentService } from './services/get-document.service';
import { DeleteDocumentService } from './services/delete-document.service';
import { DocumentsRepository } from './repositories/documents.repository';
import { RouteModule } from 'src/modules/routes/route.module';
import { MeditationModule } from 'src/modules/meditations/meditation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    MediaModule,
    MeditationModule,
    RouteModule,
    EmailModule,
    SiteUrlModule,
    UserModule,
  ],
  controllers: [DocumentsController],
  providers: [
    CreateDocumentService,
    AnnounceDocumentService,
    UpdateDocumentService,
    GetDocumentService,
    DeleteDocumentService,
    DocumentsRepository,
  ],
  exports: [
    CreateDocumentService,
    AnnounceDocumentService,
    UpdateDocumentService,
    GetDocumentService,
    DeleteDocumentService,
  ],
})
export class DocumentModule {}
