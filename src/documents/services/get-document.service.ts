import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { DocumentRepository } from '../document.repository';
import { DocumentDto } from '../dto/document-response.dto';

@Injectable()
export class GetDocumentService {
  private readonly logger = new Logger(GetDocumentService.name);

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: DocumentRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async findAll(): Promise<DocumentDto[]> {
    this.logger.log('📄 Buscando todos os documentos com mídias');

    try {
      const documents = await this.documentRepo.findAllSorted();
      if (!documents.length) return [];

      const ids = documents.map((d) => d.id);
      const mediaItems = await this.mediaItemProcessor.findManyMediaItemsByTargets(ids, 'document');

      const mediaMap = new Map<string, typeof mediaItems[number]>();
      mediaItems.forEach((media) => mediaMap.set(media.targetId, media));

      return documents.map((doc) => DocumentDto.fromEntity(doc, mediaMap.get(doc.id)));
    } catch (error) {
      this.logger.error('❌ Erro ao buscar documentos', error.stack);
      throw new InternalServerErrorException('Erro ao buscar documentos');
    }
  }

  async findOne(id: string): Promise<DocumentDto> {
    this.logger.log(`🔍 Buscando documento por ID=${id}`);

    const doc = await this.documentRepo.findOneById(id);
    if (!doc) {
      this.logger.warn(`⚠️ Documento não encontrado: ID=${id}`);
      throw new NotFoundException('Documento não encontrado');
    }

    const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'document');
    return DocumentDto.fromEntity(doc, media[0]);
  }
}
