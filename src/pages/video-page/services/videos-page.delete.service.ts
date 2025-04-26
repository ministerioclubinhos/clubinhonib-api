import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AwsS3Service } from 'src/aws/aws-s3.service';
import { RouteService } from 'src/route/route.service';
import { MediaItemProcessor } from 'src/share/media/media-item-processor';
import { MediaItemEntity } from 'src/share/media/media-item/media-item.entity';
import { VideosPageRepository } from '../video-page.repository';

@Injectable()
export class DeleteVideosPageService {
  private readonly logger = new Logger(DeleteVideosPageService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly videosPageRepo: VideosPageRepository,
    private readonly mediaItemProcessor: MediaItemProcessor,
    private readonly awsS3Service: AwsS3Service,
    private readonly routeService: RouteService,
  ) {}

  async execute(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const page = await this.videosPageRepo.findById(id);
      if (!page) throw new NotFoundException(`Página com id ${id} não encontrada`);

      const mediaItems: MediaItemEntity[] = await this.mediaItemProcessor.findMediaItemsByTarget(
        page.id,
        'VideosPage',
      );

      await this.mediaItemProcessor.deleteMediaItems(
        mediaItems,
        this.awsS3Service.delete.bind(this.awsS3Service),
      );

      if (page.route?.id) {
        await this.routeService.removeRoute(page.route.id);
      }

      await queryRunner.manager.remove(page);
      await queryRunner.commitTransaction();
      this.logger.debug(`✅ Página de vídeos removida com sucesso: ID=${id}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error('❌ Erro ao remover página de vídeos. Rollback executado.', error);
      throw new BadRequestException('Erro ao remover a página de vídeos.');
    } finally {
      await queryRunner.release();
    }
  }
}
