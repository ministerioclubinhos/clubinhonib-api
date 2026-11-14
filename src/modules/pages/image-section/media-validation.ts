import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { MediaItemDto } from 'src/shared/share-dto/media-item-dto';
import {
  MediaItemEntity,
  MediaType,
  UploadType,
} from 'src/shared/media/media-item/media-item.entity';
import {
  CLUBINHO_IMAGE_EXTENSIONS,
  CLUBINHO_VIDEO_EXTENSIONS,
  CLUBINHO_MAX_IMAGE_BYTES,
  CLUBINHO_MAX_VIDEO_BYTES,
  CLUBINHO_MAX_PHOTOS,
} from './constants';
import { UploadedFilesDict } from './types';

/** Validate the complete selection before uploads or changes to stored media. */
export function validateClubinhoMedia(
  items: MediaItemDto[],
  files: UploadedFilesDict,
  existing: MediaItemEntity[] = [],
): void {
  // Legacy albums may already contain more photos than the new upload limit.
  const photoLimit = Math.max(
    CLUBINHO_MAX_PHOTOS,
    existing.filter((media) => media.mediaType === MediaType.IMAGE).length,
  );
  const videos = items.filter((item) => item.mediaType === MediaType.VIDEO);
  if (
    !items.length ||
    items.length > photoLimit ||
    items.some(
      (item) =>
        item.mediaType !== MediaType.IMAGE &&
        item.mediaType !== MediaType.VIDEO,
    ) ||
    (videos.length > 0 && items.length !== 1)
  ) {
    throw new AppValidationException(
      ErrorCode.VALIDATION_ERROR,
      'Envie de 1 a 20 fotos ou um único vídeo, sem misturar os formatos.',
    );
  }
  const usedFields = new Set<string>();
  const usedIds = new Set<string>();
  for (const item of items) {
    const stored = item.id
      ? existing.find((media) => media.id === item.id)
      : undefined;
    if (item.id && (!stored || usedIds.has(item.id))) {
      throw new AppValidationException(
        ErrorCode.INVALID_INPUT,
        'A mídia não pertence a esta publicação ou está repetida.',
      );
    }
    if (item.id) usedIds.add(item.id);
    if (stored && stored.mediaType !== item.mediaType) {
      throw new AppValidationException(
        ErrorCode.INVALID_INPUT,
        'Remova a mídia antes de mudar seu formato.',
      );
    }
    const file = item.fieldKey ? files[item.fieldKey] : undefined;
    if (item.uploadType === UploadType.UPLOAD) {
      if (!item.isLocalFile || (!file && !stored?.isLocalFile)) {
        throw new AppValidationException(
          ErrorCode.MEDIA_FILE_NOT_FOUND,
          'Selecione o arquivo para enviar.',
        );
      }
      if (!file) continue;
      if (usedFields.has(file.fieldname)) {
        throw new AppValidationException(
          ErrorCode.INVALID_FILE,
          'O mesmo arquivo foi associado a mais de uma mídia.',
        );
      }
      usedFields.add(file.fieldname);
      const isVideo = item.mediaType === MediaType.VIDEO;
      const formats = isVideo
        ? CLUBINHO_VIDEO_EXTENSIONS
        : CLUBINHO_IMAGE_EXTENSIONS;
      const extension = file.originalname.split('.').pop()?.toLowerCase() ?? '';
      const maxBytes = isVideo
        ? CLUBINHO_MAX_VIDEO_BYTES
        : CLUBINHO_MAX_IMAGE_BYTES;
      if (
        !formats[file.mimetype]?.includes(extension) ||
        file.size <= 0 ||
        file.size > maxBytes ||
        !matchesMediaSignature(file)
      ) {
        throw new AppValidationException(
          ErrorCode.INVALID_FILE,
          isVideo
            ? 'Envie um vídeo MP4 ou WebM de até 100 MB.'
            : 'Envie fotos JPG, PNG, WebP ou GIF de até 10 MB cada.',
        );
      }
    } else {
      // Existing photo links remain supported; new videos are uploaded files.
      let validUrl = false;
      try {
        validUrl = ['http:', 'https:'].includes(
          new URL(item.url ?? '').protocol,
        );
      } catch {
        /* Invalid URL is rejected below. */
      }
      if (
        !validUrl ||
        item.isLocalFile ||
        file ||
        (item.mediaType === MediaType.VIDEO && !stored)
      ) {
        throw new AppValidationException(
          ErrorCode.INVALID_INPUT,
          'Use um link válido para fotos ou selecione um arquivo de vídeo.',
        );
      }
    }
  }
  if (Object.keys(files).some((key) => !usedFields.has(key))) {
    throw new AppValidationException(
      ErrorCode.INVALID_FILE,
      'Há arquivos sem vínculo com a publicação.',
    );
  }
}

function matchesMediaSignature(file: Express.Multer.File): boolean {
  const bytes = file.buffer;
  if (!bytes || bytes.length < 12) return false;
  switch (file.mimetype) {
    case 'image/jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'image/png':
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    case 'image/gif':
      return ['GIF87a', 'GIF89a'].includes(bytes.toString('ascii', 0, 6));
    case 'image/webp':
      return (
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP'
      );
    case 'video/mp4':
      return bytes.toString('ascii', 4, 8) === 'ftyp';
    case 'video/webm':
      return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    default:
      return false;
  }
}
