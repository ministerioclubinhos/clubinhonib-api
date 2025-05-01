import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RouteService } from 'src/route/route.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MeditationRepository } from '../meditation.repository';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { MediaTargetType } from 'src/share/media/media-target-type.enum';

@Injectable()
export class DeleteMeditationService {
  private readonly logger = new Logger(DeleteMeditationService.name);

  constructor(
    private readonly meditationRepo: MeditationRepository,
    private readonly s3Service: AwsS3Service,
    private readonly routeService: RouteService,
    private readonly mediaItemProcessor: MediaItemProcessor,
  ) {}

  async remove(id: string): Promise<void> {
    this.logger.log(`🗑️ Removendo meditação ID=${id}`);

    const meditation = await this.meditationRepo.findOneWithRelations(id);
    if (!meditation) {
      this.logger.warn(`⚠️ Meditação não encontrada: ID=${id}`);
      throw new NotFoundException('Meditação não encontrada');
    }

    const media = await this.mediaItemProcessor.findMediaItemsByTarget(id,  MediaTargetType.Meditation);
    if (media.length > 0) {
      await this.mediaItemProcessor.deleteMediaItems(media, this.s3Service.delete.bind(this.s3Service));
      this.logger.log(`🎞️ Mídias associadas removidas: ${media.length}`);
    }

    await this.routeService.removeRouteByEntity( MediaTargetType.Meditation, id);
    this.logger.log(`🛤️ Rota removida`);

    await this.meditationRepo.delete(id);
    this.logger.log(`✅ Meditação excluída com sucesso`);
  }
}
