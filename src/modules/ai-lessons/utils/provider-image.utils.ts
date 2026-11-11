import { BadGatewayException } from '@nestjs/common';
import { PROVIDER_IMAGE } from '../providers/lesson-llm.constants';
import { ProviderImageFormat } from '../providers/lesson-llm.types';

/**
 * Identifies provider image bytes by signature. Only formats the Studio stores
 * and embeds (PNG, JPEG) are accepted; anything else is a provider failure.
 */
export function detectProviderImage(buffer: Buffer): ProviderImageFormat {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0)
    throw new BadGatewayException(
      'O provedor de IA retornou uma imagem vazia.',
    );
  if (buffer.length > PROVIDER_IMAGE.maxBytes)
    throw new BadGatewayException(
      'O provedor de IA retornou uma imagem acima do tamanho permitido.',
    );
  if (
    buffer.length >= PROVIDER_IMAGE.pngSignature.length &&
    PROVIDER_IMAGE.pngSignature.every((byte, index) => buffer[index] === byte)
  )
    return { mimeType: 'image/png', extension: 'png' };
  if (
    buffer.length >= PROVIDER_IMAGE.jpegSignature.length &&
    PROVIDER_IMAGE.jpegSignature.every((byte, index) => buffer[index] === byte)
  )
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  throw new BadGatewayException(
    'O provedor de IA retornou um arquivo que não é uma imagem PNG ou JPEG válida.',
  );
}

/** Decodes and validates a base64 image returned by a provider. */
export function decodeProviderImage(encoded: string): Buffer {
  const buffer = Buffer.from(encoded, 'base64');
  detectProviderImage(buffer);
  return buffer;
}
