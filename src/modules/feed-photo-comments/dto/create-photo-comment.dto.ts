import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';
import { PHOTO_COMMENT_MAX_LENGTH } from '../constants';
import { trimPhotoCommentText } from '../utils';

export class CreatePhotoCommentDto {
  @Transform(trimPhotoCommentText)
  @IsString()
  @Length(1, PHOTO_COMMENT_MAX_LENGTH)
  text: string;

  @IsUUID('4')
  requestId: string;
}
