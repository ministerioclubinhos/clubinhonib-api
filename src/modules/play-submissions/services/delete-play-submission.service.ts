import { Injectable, Logger } from '@nestjs/common';
import {
  AppConflictException,
  AppNotFoundException,
  ErrorCode,
} from 'src/shared/exceptions';
import { AwsS3Service } from 'src/shared/providers/aws/aws-s3.service';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { PlaySubmissionRepository } from '../repositories/play-submission.repository';
import { PlaySubmissionEntity } from '../entities/play-submission.entity';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';

/** Arquivos que pertencem ao envio e saem do S3 quando ele é descartado. */
export function storedFilesOf(submission: PlaySubmissionEntity): string[] {
  return [
    submission.uploadType === UploadType.UPLOAD ? submission.url : null,
    submission.thumbnailUrl,
  ].filter((url): url is string => Boolean(url));
}

@Injectable()
export class DeletePlaySubmissionService {
  private readonly logger = new Logger(DeletePlaySubmissionService.name);

  constructor(
    private readonly repo: PlaySubmissionRepository,
    private readonly s3: AwsS3Service,
  ) {}

  /** O próprio autor retira um envio que ainda não foi decidido. */
  async withdraw(userId: string, id: string): Promise<void> {
    const submission = await this.repo.findById(id);
    // 404 também para o envio de outra pessoa: não revela que ele existe.
    if (!submission || submission.submittedById !== userId) {
      throw new AppNotFoundException(
        ErrorCode.VIDEO_NOT_FOUND,
        'Envio não encontrado.',
      );
    }
    if (submission.status !== PlaySubmissionStatus.PENDING) {
      throw new AppConflictException(
        ErrorCode.INVALID_INPUT,
        'Só é possível retirar um envio que ainda está aguardando aprovação.',
      );
    }
    await this.repo.remove(submission);
    await this.discardFiles(storedFilesOf(submission));
  }

  /** Apaga do S3 sem derrubar a operação: o registro já foi decidido. */
  async discardFiles(urls: string[]): Promise<void> {
    for (const url of urls) {
      try {
        await this.s3.delete(url);
      } catch (error: unknown) {
        this.logger.warn(
          `Não foi possível apagar o arquivo do S3: ${error instanceof Error ? error.message : 'erro'}`,
        );
      }
    }
  }
}
