import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { UploadType } from 'src/shared/media/media-item/media-item.entity';
import { isValidYoutubeUrl } from 'src/shared/media/youtube-url';
import {
  PLAY_THUMBNAIL_MAX_BYTES,
  PLAY_THUMBNAIL_MIME_PREFIX,
} from 'src/modules/play/constants';
import {
  PLAY_SUBMISSION_MAX_VIDEO_BYTES,
  PLAY_SUBMISSION_VIDEO_MIME_PREFIX,
} from './constants';
import { CreatePlaySubmissionDto } from './dto/play-submission.dto';

function fail(field: string, message: string): never {
  throw new AppValidationException(ErrorCode.INVALID_INPUT, message, {
    fieldErrors: [{ field, message }],
  });
}

/** Confere link/arquivo antes de qualquer escrita ou envio ao S3. */
export function assertSubmissionPayload(
  dto: CreatePlaySubmissionDto,
  video: Express.Multer.File | undefined,
  thumbnail: Express.Multer.File | undefined,
): void {
  if (dto.uploadType === UploadType.LINK) {
    if (!dto.url || !isValidYoutubeUrl(dto.url)) {
      fail('url', 'Informe um link válido do YouTube.');
    }
    if (video) fail('video', 'Envio por link não aceita arquivo de vídeo.');
  } else {
    if (!video) fail('video', 'Selecione o arquivo de vídeo.');
    if (!video.mimetype.startsWith(PLAY_SUBMISSION_VIDEO_MIME_PREFIX)) {
      fail('video', 'O arquivo precisa ser um vídeo.');
    }
    if (video.size > PLAY_SUBMISSION_MAX_VIDEO_BYTES) {
      fail('video', 'O vídeo deve ter até 100 MB.');
    }
  }

  if (thumbnail) {
    if (!thumbnail.mimetype.startsWith(PLAY_THUMBNAIL_MIME_PREFIX)) {
      fail('thumbnail', 'A miniatura deve ser uma imagem.');
    }
    if (thumbnail.size > PLAY_THUMBNAIL_MAX_BYTES) {
      fail('thumbnail', 'A miniatura deve ter até 2 MB.');
    }
  }
}
