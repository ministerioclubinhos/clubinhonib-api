import { Injectable, Logger } from '@nestjs/common';
import {
  AppException,
  AppInternalException,
  AppValidationException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import {
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { PlayAccessService } from 'src/modules/play/services/play-access.service';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import { CreatePlaySubmissionDto } from '../dto/play-submission.dto';
import { PlaySubmissionResponseDto } from '../dto/play-submission-response.dto';
import { toSubmissionResponse } from '../mappers';
import { assertSubmissionPayload } from '../utils';
import { PLAY_SUBMISSION_MAX_PENDING_PER_USER } from '../constants';

@Injectable()
export class CreatePlaySubmissionService {
  private readonly logger = new Logger(CreatePlaySubmissionService.name);

  constructor(
    private readonly repo: PlaySubmissionRepository,
    private readonly s3: AwsS3Service,
    private readonly access: PlayAccessService,
  ) {}

  async execute(
    userId: string,
    dto: CreatePlaySubmissionDto,
    video: Express.Multer.File | undefined,
    thumbnail: Express.Multer.File | undefined,
  ): Promise<PlaySubmissionResponseDto> {
    await this.access.assertSubmissionsEnabled();
    assertSubmissionPayload(dto, video, thumbnail);

    if (
      (await this.repo.countPendingOf(userId)) >=
      PLAY_SUBMISSION_MAX_PENDING_PER_USER
    ) {
      throw new AppValidationException(
        ErrorCode.INVALID_INPUT,
        `Você já tem ${PLAY_SUBMISSION_MAX_PENDING_PER_USER} vídeos aguardando aprovação. Espere a análise para enviar mais.`,
      );
    }

    const uploaded: string[] = [];
    try {
      const isUpload = dto.uploadType === UploadType.UPLOAD && video;
      const url = isUpload
        ? await this.s3.upload(video)
        : (dto.url ?? '').trim();
      if (isUpload) uploaded.push(url);

      let thumbnailUrl: string | null = null;
      if (thumbnail) {
        thumbnailUrl = await this.s3.upload(thumbnail);
        uploaded.push(thumbnailUrl);
      }

      const saved = await this.repo.create({
        submittedById: userId,
        title: dto.title.trim(),
        description: (dto.description ?? '').trim(),
        uploadType: dto.uploadType,
        platformType: isUpload ? null : PlatformType.YOUTUBE,
        url,
        originalName: isUpload ? video.originalname : null,
        size: isUpload ? video.size : null,
        thumbnailUrl,
        durationSeconds: dto.durationSeconds ?? null,
      });
      this.logger.log(`Envio ao Play criado. ID=${saved.id}`);
      return toSubmissionResponse(saved);
    } catch (error: unknown) {
      // Falhou depois do upload: não deixa arquivo órfão no bucket.
      await Promise.all(
        uploaded.map((url) => this.s3.delete(url).catch(() => undefined)),
      );
      if (error instanceof AppException) throw error;
      throw new AppInternalException(
        ErrorCode.PAGE_CREATE_ERROR,
        'Erro ao enviar o vídeo.',
        error as Error,
      );
    }
  }
}
