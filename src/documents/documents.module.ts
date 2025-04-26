import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentEntity } from './entities/document.entity';
import { MediaModule } from 'src/share/media/media.module';

import { CreateDocumentService } from './services/create-document.service';
import { UpdateDocumentService } from './services/update-document.service';
import { GetDocumentService } from './services/get-document.service';
import { DeleteDocumentService } from './services/delete-document.service';
import { DocumentRepository } from './document.repository';
import { DataSource } from 'typeorm';

@Module({
  imports: [
    TypeOrmModule.forFeature([DocumentEntity]),
    MediaModule,
  ],
  controllers: [DocumentsController],
  providers: [
    CreateDocumentService,
    UpdateDocumentService,
    GetDocumentService,
    DeleteDocumentService,
        {
          provide: DocumentRepository,
          useFactory: (dataSource: DataSource) => new DocumentRepository(dataSource),
          inject: [DataSource],
        },
  ],
  exports: [
    CreateDocumentService,
    UpdateDocumentService,
    GetDocumentService,
    DeleteDocumentService,
  ],
})
export class DocumentModule {}
