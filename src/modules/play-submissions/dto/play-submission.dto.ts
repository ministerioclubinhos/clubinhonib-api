import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { PLAY_MAX_DURATION_SECONDS } from 'src/modules/play/constants';
import {
  PLAY_SUBMISSION_DESCRIPTION_MAX_LENGTH,
  PLAY_SUBMISSION_REASON_MAX_LENGTH,
  PLAY_SUBMISSION_TITLE_MAX_LENGTH,
  PLAY_SUBMISSIONS_DEFAULT_LIMIT,
  PLAY_SUBMISSIONS_DEFAULT_PAGE,
  PLAY_SUBMISSIONS_MAX_LIMIT,
} from '../constants';
import { PlaySubmissionStatus } from '../enums/play-submission-status.enum';

/** JSON do campo `submissionData`. */
export class CreatePlaySubmissionDto {
  @IsString({ message: 'O título deve ser um texto.' })
  @Matches(/\S/, { message: 'O título não pode ficar vazio.' })
  @MaxLength(PLAY_SUBMISSION_TITLE_MAX_LENGTH, {
    message: 'Use até 255 caracteres.',
  })
  title: string;

  @IsOptional()
  @IsString({ message: 'A descrição deve ser um texto.' })
  @MaxLength(PLAY_SUBMISSION_DESCRIPTION_MAX_LENGTH, {
    message: 'Use até 2000 caracteres.',
  })
  description?: string;

  @IsEnum(UploadType, {
    message: 'O tipo de envio deve ser "link" ou "upload".',
  })
  uploadType: UploadType;

  /** Link do YouTube (quando `uploadType = link`). */
  @IsOptional()
  @IsString({ message: 'O link deve ser um texto.' })
  url?: string;

  /** Duração lida no navegador (só uploads). */
  @IsOptional()
  @IsInt({ message: 'A duração deve ser um número inteiro de segundos.' })
  @Min(0)
  @Max(PLAY_MAX_DURATION_SECONDS)
  durationSeconds?: number;
}

export class ApprovePlaySubmissionDto {
  /** Galeria (com Play ligado) que vai receber o vídeo. */
  @IsUUID('all', { message: 'Escolha a galeria que vai receber o vídeo.' })
  galleryId: string;

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}

export class RejectPlaySubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(PLAY_SUBMISSION_REASON_MAX_LENGTH, {
    message: 'Use até 500 caracteres.',
  })
  reason?: string;
}

export class QueryPlaySubmissionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = PLAY_SUBMISSIONS_DEFAULT_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(PLAY_SUBMISSIONS_MAX_LIMIT)
  limit?: number = PLAY_SUBMISSIONS_DEFAULT_LIMIT;

  @IsOptional()
  @IsEnum(PlaySubmissionStatus)
  status?: PlaySubmissionStatus = PlaySubmissionStatus.PENDING;
}
