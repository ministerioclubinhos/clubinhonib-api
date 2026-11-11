import type { LessonUploadImageMetadata } from '../types/lesson-generation.types';
import { detectProviderImage } from './provider-image.utils';

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

/** Raised when a provider returns something that is not a usable picture. */
export class LessonGeneratedImageInvalidError extends Error {
  constructor(reason: string) {
    super(`Imagem gerada inválida: ${reason}`);
    this.name = 'LessonGeneratedImageInvalidError';
  }
}

function startsWith(buffer: Buffer, signature: readonly number[]): boolean {
  return (
    buffer.length >= signature.length &&
    signature.every((byte, index) => buffer[index] === byte)
  );
}

/** File type by content, defaulting to PNG as the providers are asked for. */
export function lessonUploadImageMetadata(
  buffer: Buffer,
): LessonUploadImageMetadata {
  return startsWith(buffer, JPEG_SIGNATURE)
    ? { extension: 'jpg', mimeType: 'image/jpeg' }
    : { extension: 'png', mimeType: 'image/png' };
}

/**
 * Validates generated artwork before it is stored, using the provider-image
 * contract (real PNG/JPEG bytes within the size budget).
 */
export function assertLessonUploadImage(
  buffer: unknown,
): LessonUploadImageMetadata {
  if (!Buffer.isBuffer(buffer))
    throw new LessonGeneratedImageInvalidError(
      'o provedor não retornou os dados da imagem.',
    );
  try {
    return detectProviderImage(buffer);
  } catch (error: unknown) {
    throw new LessonGeneratedImageInvalidError(
      error instanceof Error ? error.message : String(error),
    );
  }
}
