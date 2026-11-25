import { Injectable, Logger } from '@nestjs/common';
import {
  AppConflictException,
  AppNotFoundException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { MediaItemProcessor } from 'src/shared/media/media-item-processor';
import { MediaType } from 'src/shared/media/media-item/media-item.entity';
import { MediaTargetType } from 'src/shared/media/media-target-type.enum';
import { GetVideosPageService } from 'src/modules/pages/video-page/services/get-video-page.service';
import { SyncPlayEntriesService } from 'src/modules/play/services/sync-play-entries.service';
import { PlayScope } from 'src/modules/play/enums/play-scope.enum';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import { PlaySubmissionEntity } from '../entities/play-submission.entity';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';
import {
  ApprovePlaySubmissionDto,
  RejectPlaySubmissionDto,
} from '../dto/play-submission.dto';
import { PlaySubmissionResponseDto } from '../dto/play-submission-response.dto';
import { toSubmissionResponse } from '../mappers';
import {
  DeletePlaySubmissionService,
  storedFilesOf,
} from './delete-play-submission.service';

/** Decisão do administrador: aprovar (publica numa galeria) ou reprovar. */
@Injectable()
export class ReviewPlaySubmissionService {
  private readonly logger = new Logger(ReviewPlaySubmissionService.name);

  constructor(
    private readonly repo: PlaySubmissionRepository,
    private readonly galleries: GetVideosPageService,
    private readonly media: MediaItemProcessor,
    private readonly syncPlay: SyncPlayEntriesService,
    private readonly cleanup: DeletePlaySubmissionService,
  ) {}

  private async pendingOrFail(id: string): Promise<PlaySubmissionEntity> {
    const submission = await this.repo.findById(id);
    if (!submission) {
      throw new AppNotFoundException(
        ErrorCode.VIDEO_NOT_FOUND,
        'Envio não encontrado.',
      );
    }
    if (submission.status !== PlaySubmissionStatus.PENDING) {
      throw new AppConflictException(
        ErrorCode.INVALID_INPUT,
        'Este envio já foi analisado por outro administrador.',
      );
    }
    return submission;
  }

  /**
   * Cria o vídeo na galeria escolhida e o põe no Play, tudo na mesma transação
   * que marca o envio como aprovado.
   */
  async approve(
    adminId: string,
    id: string,
    dto: ApprovePlaySubmissionDto,
  ): Promise<PlaySubmissionResponseDto> {
    const submission = await this.pendingOrFail(id);
    const gallery = await this.galleries.findEntityOrFail(dto.galleryId);

    if (gallery.playScope === PlayScope.NONE) {
      const message =
        'A galeria escolhida não está no Clubinho Play. Escolha outra ou ligue o Play nela.';
      throw new AppValidationException(ErrorCode.INVALID_INPUT, message, {
        fieldErrors: [{ field: 'galleryId', message }],
      });
    }

    const saved = await this.repo.runInTransaction(async (manager) => {
      const item = this.media.buildBaseMediaItem(
        {
          title: submission.title,
          description: submission.description,
          mediaType: MediaType.VIDEO,
          uploadType: submission.uploadType,
          platformType: submission.platformType,
          url: submission.url,
          originalName: submission.originalName ?? '',
          size: submission.size ?? 0,
          isLocalFile: Boolean(submission.originalName),
        },
        gallery.id,
        MediaTargetType.VideosPage,
      );
      const media = await this.media.saveMediaItemInTransaction(manager, item);

      await this.syncPlay.addApproved(
        gallery.id,
        media.id,
        {
          thumbnailUrl: submission.thumbnailUrl,
          durationSeconds: submission.durationSeconds,
          featured: dto.featured === true,
        },
        manager,
      );

      submission.status = PlaySubmissionStatus.APPROVED;
      submission.reviewedById = adminId;
      submission.reviewedAt = new Date();
      submission.rejectionReason = null;
      submission.mediaItemId = media.id;
      return this.repo.save(submission, manager);
    });

    this.logger.log(`Envio aprovado. ID=${id} galeria=${gallery.id}`);
    return toSubmissionResponse(saved, true);
  }

  /** Reprova e apaga os arquivos enviados (o vídeo nunca foi publicado). */
  async reject(
    adminId: string,
    id: string,
    dto: RejectPlaySubmissionDto,
  ): Promise<PlaySubmissionResponseDto> {
    const submission = await this.pendingOrFail(id);
    const files = storedFilesOf(submission);

    submission.status = PlaySubmissionStatus.REJECTED;
    submission.reviewedById = adminId;
    submission.reviewedAt = new Date();
    submission.rejectionReason = dto.reason?.trim() || null;
    // O arquivo some do S3; a URL não pode continuar apontando para ele.
    if (files.length > 0) {
      submission.thumbnailUrl = null;
      if (submission.originalName) submission.url = '';
    }
    const saved = await this.repo.save(submission);

    await this.cleanup.discardFiles(files);
    this.logger.log(`Envio reprovado. ID=${id}`);
    return toSubmissionResponse(saved, true);
  }
}
