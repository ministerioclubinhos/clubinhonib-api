import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { DocumentRepository } from '../document.repository';
import { RouteService } from 'src/route/route.service';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';

@Injectable()
export class DeleteDocumentService {
  private readonly logger = new Logger(DeleteDocumentService.name);

  constructor(
    @Inject(DocumentRepository)
    private readonly documentRepo: DocumentRepository,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,

    private readonly mediaItemProcessor: MediaItemProcessor,
  ) { }

  async execute(id: string): Promise<void> {
    this.logger.log(`🗑️ [DELETE] Iniciando remoção do documento ID=${id}`);

    const document = await this.documentRepo.findOneById(id);
    if (!document) {
      this.logger.warn(`⚠️ Documento não encontrado: ID=${id}`);
      throw new NotFoundException('Documento não encontrado');
    }

    try {
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, 'document');
      if (media.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(media, this.s3Service.delete.bind(this.s3Service));
        this.logger.log(`🧹 ${media.length} mídias associadas removidas`);
      }

      await this.documentRepo.remove(document);
      await this.routeService.removeRouteByEntity(MediaTargetType.Document, id);
      this.logger.log(`🛤️ Rota removida`);

      this.logger.log(`✅ Documento removido com sucesso: ID=${id}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao remover documento ID=${id}`, error.stack);
      throw new InternalServerErrorException('Erro ao remover documento.');
    }
  }
}
