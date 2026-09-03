import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentEntity } from './entities/document.entity';
import { MediaModule } from 'src/shared/media/media.module';

import { CreateDocumentService } from './services/create-document.service';
import { UpdateDocumentService } from './services/update-document.service';
import { GetDocumentService } from './services/get-document.service';
import { DeleteDocumentService } from './services/delete-document.service';
import { DocumentsRepository } from './repositories/documents.repository';
import { RouteService } from 'src/modules/routes/route.service';
import { RouteRepository } from 'src/modules/routes/route-page.repository';
import { MeditationModule } from 'src/modules/meditations/meditation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    MediaModule,
    MeditationModule,
  ],
  controllers: [DocumentsController],
  providers: [
    CreateDocumentService,
    UpdateDocumentService,
    GetDocumentService,
    RouteService,
    DeleteDocumentService,
    DocumentsRepository,
    RouteRepository,
  ],
  exports: [
    CreateDocumentService,
    UpdateDocumentService,
    GetDocumentService,
    DeleteDocumentService,
  ],
})
export class DocumentModule {}
