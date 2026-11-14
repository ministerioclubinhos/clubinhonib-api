import { Injectable } from '@nestjs/common';

import { AppNotFoundException, ErrorCode } from 'src/shared/exceptions';
import { Paginated } from 'src/shared/dto/paginated.dto';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';

import { DocumentsRepository } from '../repositories/documents.repository';
import { QueryDocumentsDto } from '../dto/query-documents.dto';
import { DocumentResponseDto } from '../dto/document-response.dto';
import { DocumentEntity } from '../entities/document.entity';
import { toDocumentResponse } from '../mappers';
import {
  DOCUMENTS_DEFAULT_LIMIT,
  DOCUMENTS_DEFAULT_PAGE,
  DOCUMENT_MEDIA_TARGET_TYPES,
} from '../constants';

@Injectable()
export class GetDocumentService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async findEntityOrFail(id: string): Promise<DocumentEntity> {
    const document = await this.documentsRepository.findById(id);

    if (!document) {
      throw new AppNotFoundException(
        ErrorCode.DOCUMENT_NOT_FOUND,
        'Documento não encontrado',
      );
    }

    return document;
  }

  async findAllPaginated(
    query: QueryDocumentsDto,
  ): Promise<Paginated<DocumentResponseDto>> {
    const page = query.page ?? DOCUMENTS_DEFAULT_PAGE;
    const limit = query.limit ?? DOCUMENTS_DEFAULT_LIMIT;

    const { items, total } =
      await this.documentsRepository.findAllPaginated(query);

    // Uma consulta de mídias para a página inteira, e não uma por documento.
    const medias =
      await this.mediaItemProcessor.findManyMediaItemsByTargetsAnyType(
        items.map((document) => document.id),
        DOCUMENT_MEDIA_TARGET_TYPES,
      );

    const porDocumento = new Map(
      medias.map((media) => [media.targetId, media]),
    );

    const data = items.map((document) =>
      toDocumentResponse(document, porDocumento.get(document.id)),
    );

    return new Paginated(data, total, page, limit);
  }

  async findOne(id: string): Promise<DocumentResponseDto> {
    const document = await this.findEntityOrFail(id);

    const medias = await this.mediaItemProcessor.findMediaItemsByTargetAnyType(
      id,
      DOCUMENT_MEDIA_TARGET_TYPES,
    );

    return toDocumentResponse(document, medias[0]);
  }
}
