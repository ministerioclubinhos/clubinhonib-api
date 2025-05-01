import {
    Injectable,
    Logger,
    NotFoundException,
  } from '@nestjs/common';
  import { EventRepository } from '../event.repository';
  import { AwsS3Service } from 'src/aws/aws-s3.service';
  import { MediaItemProcessor } from 'src/share/media/media-item-processor';
  import { RouteService } from 'src/route/route.service';
  import { MediaTargetType } from 'src/share/media/media-target-type.enum';
  
  @Injectable()
  export class DeleteEventService {
    private readonly logger = new Logger(DeleteEventService.name);
  
    constructor(
      private readonly eventRepo: EventRepository,
      private readonly s3Service: AwsS3Service,
      private readonly mediaItemProcessor: MediaItemProcessor,
      private readonly routeService: RouteService,
    ) {}
  
    async remove(id: string): Promise<void> {
      this.logger.log(`🗑️ Removendo evento ID=${id}`);
  
      const event = await this.eventRepo.findById(id);
      if (!event) {
        this.logger.warn(`⚠️ Evento não encontrado: ID=${id}`);
        throw new NotFoundException('Evento não encontrado');
      }
  
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(id, MediaTargetType.Event);
      if (media.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(media, this.s3Service.delete.bind(this.s3Service));
        this.logger.log(`🎞️ Mídias associadas removidas: ${media.length}`);
      }
  
      await this.routeService.removeRouteByEntity(MediaTargetType.Event, id);
      this.logger.log(`🛤️ Rota associada removida`);
  
      await this.eventRepo.delete(id);
      this.logger.log(`✅ Evento excluído com sucesso`);
    }
  }
  