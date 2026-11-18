import { ErrorCode } from 'src/shared/exceptions';
import { IdeasMediaValidationException } from './ideas-media-validation.exception';
import {
  MediaType,
  PlatformType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import { isValidYoutubeUrl } from 'src/shared/media/youtube-url';
import {
  IDEAS_SHARE_DOCUMENT_FORMATS,
  IDEAS_SHARE_IMAGE_FORMATS,
  IDEAS_SHARE_MAX_DOCUMENT_BYTES,
  IDEAS_SHARE_MAX_IMAGE_BYTES,
  IDEAS_SHARE_MAX_MEDIAS,
  IDEAS_SHARE_MAX_VIDEO_BYTES,
  IDEAS_SHARE_VIDEO_FORMATS,
} from './constants';
import { IdeasSectionMediaItemDto } from './dto/ideas-section-media-item.dto';
import { IdeasSectionMediaType } from './entities/ideas-section-media-type.enum';
import { UploadedFilesDict, IdeasFormatMap } from './types';
import { MediaItemEntity } from 'src/shared/media/media-item/media-item.entity';

function validateFile(
  file: Express.Multer.File,
  formats: IdeasFormatMap,
  maxBytes: number,
  name: string,
): void {
  const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
  const allowedExtensions = formats[file.mimetype];
  if (
    !file.size ||
    file.size > maxBytes ||
    !allowedExtensions?.includes(extension)
  ) {
    throw new IdeasMediaValidationException(
      ErrorCode.INVALID_FILE,
      `O arquivo "${name}" está vazio, excede o limite ou tem formato inválido.`,
    );
  }
}

export function validateIdeasShareMedia(
  items: IdeasSectionMediaItemDto[] | undefined,
  files: UploadedFilesDict,
  existing: readonly MediaItemEntity[] = [],
  requireMedia = true,
): void {
  const medias = items ?? [];
  if (
    (requireMedia && medias.length < 1) ||
    medias.length > IDEAS_SHARE_MAX_MEDIAS
  ) {
    throw new IdeasMediaValidationException(
      ErrorCode.VALIDATION_ERROR,
      `Envie de 1 a ${IDEAS_SHARE_MAX_MEDIAS} mídias.`,
    );
  }
  const usedFields = new Set<string>();
  const seenIds = new Set<string>();
  for (const [index, media] of medias.entries()) {
    if (media.id) {
      if (seenIds.has(media.id))
        throw new IdeasMediaValidationException(
          ErrorCode.INVALID_INPUT,
          'A mesma mídia foi informada mais de uma vez.',
        );
      seenIds.add(media.id);
      const source = existing.find((candidate) => candidate.id === media.id);
      if (!source)
        throw new IdeasMediaValidationException(
          ErrorCode.INVALID_INPUT,
          'Uma mídia informada não pertence a esta ideia.',
        );
      const sameType =
        (source.mediaType === MediaType.VIDEO &&
          media.mediaType === IdeasSectionMediaType.VIDEO) ||
        (source.mediaType === MediaType.DOCUMENT &&
          media.mediaType === IdeasSectionMediaType.DOCUMENT) ||
        (source.mediaType === MediaType.IMAGE &&
          media.mediaType === IdeasSectionMediaType.IMAGE);
      if (!sameType)
        throw new IdeasMediaValidationException(
          ErrorCode.INVALID_INPUT,
          'O tipo de uma mídia existente não pode ser alterado.',
        );
      const unchanged =
        !media.fieldKey &&
        !files[media.id] &&
        media.uploadType === source.uploadType &&
        media.url === source.url &&
        media.isLocalFile === source.isLocalFile;
      if (unchanged) continue;
    }
    if ((media.uploadType === UploadType.UPLOAD) !== media.isLocalFile)
      throw new IdeasMediaValidationException(
        ErrorCode.INVALID_INPUT,
        'A origem da mídia deve corresponder ao envio por arquivo ou link.',
      );
    if (media.uploadType === UploadType.LINK) {
      if (
        media.mediaType !== IdeasSectionMediaType.VIDEO ||
        media.platformType !== PlatformType.YOUTUBE ||
        !media.url ||
        !isValidYoutubeUrl(media.url)
      ) {
        throw new IdeasMediaValidationException(
          ErrorCode.VALIDATION_ERROR,
          'Vídeos por link devem usar uma URL válida do YouTube. Documentos e imagens precisam ser enviados como arquivo.',
        );
      }
      continue;
    }
    if (!media.fieldKey || usedFields.has(media.fieldKey)) {
      throw new IdeasMediaValidationException(
        ErrorCode.INVALID_FILE,
        'Cada arquivo deve estar associado a uma única mídia.',
      );
    }
    usedFields.add(media.fieldKey);
    const file = files[media.fieldKey];
    if (!file)
      throw new IdeasMediaValidationException(
        ErrorCode.MEDIA_FILE_NOT_FOUND,
        `O arquivo "${media.originalName ?? `mídia ${index + 1}`}" não veio na requisição.`,
      );
    const formats =
      media.mediaType === IdeasSectionMediaType.DOCUMENT
        ? IDEAS_SHARE_DOCUMENT_FORMATS
        : media.mediaType === IdeasSectionMediaType.IMAGE
          ? IDEAS_SHARE_IMAGE_FORMATS
          : IDEAS_SHARE_VIDEO_FORMATS;
    const limit =
      media.mediaType === IdeasSectionMediaType.DOCUMENT
        ? IDEAS_SHARE_MAX_DOCUMENT_BYTES
        : media.mediaType === IdeasSectionMediaType.IMAGE
          ? IDEAS_SHARE_MAX_IMAGE_BYTES
          : IDEAS_SHARE_MAX_VIDEO_BYTES;
    validateFile(file, formats, limit, media.originalName ?? file.originalname);
  }
  const extraFiles = Object.keys(files).filter(
    (field) =>
      !usedFields.has(field) && !medias.some((media) => media.id === field),
  );
  if (extraFiles.length)
    throw new IdeasMediaValidationException(
      ErrorCode.INVALID_FILE,
      'A requisição contém arquivos sem mídia correspondente.',
    );
}
