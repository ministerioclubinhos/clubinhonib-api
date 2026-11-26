import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { PlayConfigDto } from './dto/play-config.dto';
import { PlayScope } from './enums/play-scope.enum';
import {
  PLAY_THUMBNAIL_MAX_BYTES,
  PLAY_THUMBNAIL_MIME_PREFIX,
} from './constants';
import { PlayEntryInput, PlayFilesDict, PlayVideoFlags } from './types';

function fail(index: number, field: string, text: string): never {
  const message = `Vídeo ${index + 1}: ${text}`;
  throw new AppValidationException(ErrorCode.INVALID_INPUT, message, {
    fieldErrors: [{ field: `videos.${index}.${field}`, message }],
  });
}

/**
 * Confere os atributos de Play de cada vídeo contra o modo da galeria, antes
 * de qualquer escrita. `play` ausente significa "não mexer no Play".
 */
export function assertPlayPayload(
  play: PlayConfigDto | undefined,
  videos: PlayVideoFlags[],
): void {
  videos.forEach((video, index) => {
    const touched = (
      [
        'inPlay',
        'featured',
        'position',
        'thumbnailField',
        'durationSeconds',
      ] as const
    ).filter((key) => video[key] !== undefined);

    if (!play || play.scope === PlayScope.NONE) {
      if (touched.length > 0) {
        fail(
          index,
          touched[0],
          'informe um modo do Play diferente de "não aparece" para configurar o vídeo.',
        );
      }
      return;
    }

    if (play.scope === PlayScope.ALL && video.inPlay !== undefined) {
      fail(
        index,
        'inPlay',
        'a escolha por vídeo só vale no modo "só alguns vídeos".',
      );
    }

    if (
      play.scope === PlayScope.SELECTED &&
      video.inPlay !== true &&
      (video.featured !== undefined || video.position !== undefined)
    ) {
      fail(
        index,
        video.featured !== undefined ? 'featured' : 'position',
        'destaque e posição exigem que o vídeo esteja no Play.',
      );
    }
  });
}

/** Miniatura/duração já gravadas de um vídeo, preservadas se o payload não trouxer novas. */
export interface PreviousEntryData {
  thumbnailUrl: string | null;
  durationSeconds: number | null;
}

/**
 * Monta as linhas de `play_video_entries`. `mediaIds` está na mesma ordem de
 * `videos` (o id existente ou o da mídia recém-criada). `thumbnails` traz a URL
 * das miniaturas enviadas nesta requisição, na mesma ordem.
 */
export function buildEntryInputs(
  scope: PlayScope,
  mediaIds: string[],
  videos: PlayVideoFlags[],
  thumbnails: (string | null)[] = [],
  previous: ReadonlyMap<string, PreviousEntryData> = new Map(),
): PlayEntryInput[] {
  if (scope === PlayScope.NONE) return [];

  const entries: PlayEntryInput[] = [];
  videos.forEach((video, index) => {
    if (scope === PlayScope.SELECTED && video.inPlay !== true) return;
    const before = previous.get(mediaIds[index]);
    entries.push({
      mediaItemId: mediaIds[index],
      featured: video.featured === true,
      position: video.position ?? null,
      thumbnailUrl: thumbnails[index] ?? before?.thumbnailUrl ?? null,
      durationSeconds: video.durationSeconds ?? before?.durationSeconds ?? null,
    });
  });
  return entries;
}

/** Miniaturas declaradas precisam vir como imagem pequena, antes de qualquer escrita. */
export function assertThumbnails(
  videos: PlayVideoFlags[],
  files: PlayFilesDict,
): void {
  videos.forEach((video, index) => {
    if (!video.thumbnailField) return;
    const file = files[video.thumbnailField];
    if (!file) fail(index, 'thumbnailField', 'a miniatura não foi enviada.');
    if (!file.mimetype.startsWith(PLAY_THUMBNAIL_MIME_PREFIX)) {
      fail(index, 'thumbnailField', 'a miniatura deve ser uma imagem.');
    }
    if (file.size > PLAY_THUMBNAIL_MAX_BYTES) {
      fail(index, 'thumbnailField', 'a miniatura deve ter até 2 MB.');
    }
  });
}

/** `slug` de categoria: minúsculas, sem acento, hífens. */
export function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
