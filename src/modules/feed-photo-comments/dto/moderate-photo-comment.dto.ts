import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';
import { PhotoCommentStatus } from '../types';
import { PHOTO_COMMENT_REASON_MAX_LENGTH } from '../constants';
import { trimPhotoCommentText } from '../utils';

export class ModeratePhotoCommentDto {
  @IsIn([PhotoCommentStatus.APPROVED, PhotoCommentStatus.REJECTED])
  status: PhotoCommentStatus.APPROVED | PhotoCommentStatus.REJECTED;

  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ValidateIf(
    (dto: ModeratePhotoCommentDto) =>
      dto.status === PhotoCommentStatus.REJECTED || dto.reason !== undefined,
  )
  @Transform(trimPhotoCommentText)
  @IsString()
  @Length(1, PHOTO_COMMENT_REASON_MAX_LENGTH, {
    message: 'Informe o motivo da reprovação (até 500 caracteres).',
  })
  reason?: string;
}
