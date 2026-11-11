import { UnprocessableEntityException } from '@nestjs/common';
import type {
  FittedImage,
  ImageBox,
  ImageDimensions,
} from '../types/image-dimensions.types';

const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);

function pngDimensions(data: Buffer): ImageDimensions | null {
  if (
    data.length < 24 ||
    data.readUInt32BE(0) !== 0x89504e47 ||
    data.subarray(12, 16).toString('latin1') !== 'IHDR'
  )
    return null;
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    type: 'png',
  };
}

function jpegDimensions(data: Buffer): ImageDimensions | null {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = data[offset + 1];
    // Fill bytes and standalone markers carry no segment length.
    if (marker === 0xff) {
      offset++;
      continue;
    }
    if (
      marker === 0xd8 ||
      (marker >= 0xd0 && marker <= 0xd7) ||
      marker === 0x01
    ) {
      offset += 2;
      continue;
    }
    const length = data.readUInt16BE(offset + 2);
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      return {
        height: data.readUInt16BE(offset + 5),
        width: data.readUInt16BE(offset + 7),
        type: 'jpg',
      };
    }
    if (length < 2) return null;
    offset += 2 + length;
  }
  return null;
}

function webpDimensions(data: Buffer): ImageDimensions | null {
  if (
    data.length < 30 ||
    data.subarray(0, 4).toString('latin1') !== 'RIFF' ||
    data.subarray(8, 12).toString('latin1') !== 'WEBP'
  )
    return null;
  const chunk = data.subarray(12, 16).toString('latin1');
  if (chunk === 'VP8X')
    return {
      width: 1 + data.readUIntLE(24, 3),
      height: 1 + data.readUIntLE(27, 3),
      type: 'webp',
    };
  if (chunk === 'VP8L') {
    const bits = data.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff),
      type: 'webp',
    };
  }
  if (chunk === 'VP8 ')
    return {
      width: data.readUInt16LE(26) & 0x3fff,
      height: data.readUInt16LE(28) & 0x3fff,
      type: 'webp',
    };
  return { width: 0, height: 0, type: 'webp' };
}

/** Real pixel size and container type read from the image header. */
export function readImageDimensions(data: Buffer): ImageDimensions | null {
  if (!Buffer.isBuffer(data)) return null;
  const dimensions =
    pngDimensions(data) ?? jpegDimensions(data) ?? webpDimensions(data);
  if (!dimensions) return null;
  if (dimensions.type !== 'webp' && (!dimensions.width || !dimensions.height))
    return null;
  return dimensions;
}

/**
 * Largest size that fits `box` keeping the image's own proportions.
 * WebP cannot be embedded in a DOCX and is rejected explicitly; an image whose
 * header cannot be read falls back to `fallbackRatio` (or the box itself).
 */
export function fitImageInBox(
  data: Buffer,
  box: ImageBox,
  fallbackRatio?: number,
): FittedImage {
  const dimensions = readImageDimensions(data);
  if (dimensions?.type === 'webp')
    throw new UnprocessableEntityException(
      'Uma imagem deste item está em formato WebP, que não pode ser incorporado ao documento. Gere a arte novamente (PNG ou JPEG).',
    );
  const ratio = dimensions
    ? dimensions.width / dimensions.height
    : (fallbackRatio ?? box.width / box.height);
  const width = Math.min(box.width, box.height * ratio);
  return {
    width: Math.round(width),
    height: Math.round(width / ratio),
    type: dimensions?.type ?? 'png',
  };
}
