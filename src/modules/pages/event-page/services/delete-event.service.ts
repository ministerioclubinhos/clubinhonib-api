import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { DeleteRouteService } from 'src/modules/routes/services/delete-route.service';
import { EventRepository } from '../repositories/event.repository';
import { GetEventService } from './get-event.service';
import { AnnounceEventService } from './announce-event.service';
import { EVENT_MEDIA_TARGET_TYPE } from '../constants';
import { assertNotClubMeeting } from '../utils';

@Injectable()
export class DeleteEventService {
  private readonly logger = new Logger(DeleteEventService.name);

  constructor(
    private readonly eventRepo: EventRepository,
    private readonly getService: GetEventService,
    private readonly s3Service: AwsS3Service,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly deleteRouteService: DeleteRouteService,
    private readonly announceService: AnnounceEventService,
  ) {}

  async remove(id: string): Promise<void> {
    const event = await this.getService.findEntityOrFail(id);
    assertNotClubMeeting(event);

    try {
      const media = await this.mediaItemProcessor.findMediaItemsByTarget(
        id,
        EVENT_MEDIA_TARGET_TYPE,
      );

      if (media.length > 0) {
        await this.mediaItemProcessor.deleteMediaItems(media, (url: string) =>
          this.s3Service.delete(url),
        );
        this.logger.debug(
          `${media.length} mídia(s) removida(s) do evento ${id}`,
        );
      }

      await this.deleteRouteService.removeRouteByEntity(
        EVENT_MEDIA_TARGET_TYPE,
        id,
      );
      await this.eventRepo.removeById(id);

      this.logger.log(`Evento removido. ID=${id}`);

      // Os dados foram lidos antes da exclusão: é o que o aviso mostra.
      this.announceService.announceInBackground('cancelled', event);
    } catch (error: unknown) {
      this.logger.error(
        `Erro ao remover evento. ID=${id}`,
        error instanceof Error ? error.stack : undefined,
      );

      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.INTERNAL_ERROR,
        'Erro ao remover o evento.',
        error as Error,
      );
    }
  }
}
