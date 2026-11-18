import { UnprocessableEntityException } from '@nestjs/common';
import {
  createConcurrencyLimiter,
  mapWithConcurrency,
} from './concurrency.utils';
import { normalizeDocxColor, sanitizeDocxText } from './docx-text.utils';
import { fitImageInBox, readImageDimensions } from './image-dimensions.utils';
import {
  isPuzzleGridBlock,
  isPuzzleGridRow,
  isWordSearchGridRow,
} from './meditation-grid.utils';
import { documentFontFamily, documentFontSize } from '../lessonDocument.utils';

function png(width: number, height: number): Buffer {
  const data = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(data);
  data.writeUInt32BE(13, 8);
  data.write('IHDR', 12, 'latin1');
  data.writeUInt32BE(width, 16);
  data.writeUInt32BE(height, 20);
  return data;
}

function jpeg(width: number, height: number): Buffer {
  const sof = Buffer.from([0xff, 0xc0, 0x00, 0x11, 0x08, 0, 0, 0, 0, 0x03]);
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46]),
    sof,
    Buffer.alloc(12),
  ]);
}

function webp(): Buffer {
  const data = Buffer.alloc(30);
  data.write('RIFF', 0, 'latin1');
  data.write('WEBP', 8, 'latin1');
  data.write('VP8X', 12, 'latin1');
  return data;
}

describe('DOCX export helpers', () => {
  it('normaliza cores CSS para hex de seis dígitos e descarta o que não entende', () => {
    expect(normalizeDocxColor('#c53030')).toBe('C53030');
    expect(normalizeDocxColor('#f00')).toBe('FF0000');
    expect(normalizeDocxColor('rgb(255, 0, 0)')).toBe('FF0000');
    expect(normalizeDocxColor('rgba(0 128 255 / 50%)')).toBe('0080FF');
    expect(normalizeDocxColor('Yellow')).toBe('FFFF00');
    expect(normalizeDocxColor('var(--x)')).toBeUndefined();
    expect(normalizeDocxColor('rgb(1, 2)')).toBeUndefined();
    expect(normalizeDocxColor(null)).toBeUndefined();
  });

  it('remove caracteres de controle inválidos em XML e preserva tab e quebras', () => {
    expect(sanitizeDocxText('ab\u0001c\u000bd\u0000￾')).toBe('abcd');
    expect(sanitizeDocxText('linha\tcom\nquebra\r')).toBe(
      'linha\tcom\nquebra\r',
    );
  });

  it('converte tamanhos relativos e rejeita famílias que não são fontes', () => {
    expect(documentFontSize('1.5em', 24)).toBe(36);
    expect(documentFontSize('150%', 20)).toBe(30);
    expect(documentFontSize('2rem', 24)).toBe(48);
    expect(documentFontSize('300pt')).toBeUndefined();
    expect(documentFontFamily('"Times New Roman", serif')).toBe(
      'Times New Roman',
    );
    expect(documentFontFamily('var(--font)')).toBeUndefined();
  });

  it('lê dimensões reais de PNG e JPEG e ajusta sem deformar', () => {
    expect(readImageDimensions(png(1536, 1024))).toEqual({
      width: 1536,
      height: 1024,
      type: 'png',
    });
    expect(readImageDimensions(jpeg(1024, 1536))).toEqual({
      width: 1024,
      height: 1536,
      type: 'jpg',
    });
    expect(readImageDimensions(Buffer.from('mock-logo'))).toBeNull();

    const landscape = fitImageInBox(png(1536, 1024), {
      width: 1070,
      height: 758,
    });
    expect(landscape).toEqual({ width: 1070, height: 713, type: 'png' });
    const portrait = fitImageInBox(jpeg(1024, 1536), {
      width: 1070,
      height: 758,
    });
    expect(portrait.type).toBe('jpg');
    expect(portrait.height).toBe(758);
    expect(portrait.width / portrait.height).toBeCloseTo(1024 / 1536, 2);
    // Unknown header: previous behaviour (fill the box) is kept.
    expect(
      fitImageInBox(Buffer.from('mock-logo'), { width: 190, height: 95 }),
    ).toEqual({ width: 190, height: 95, type: 'png' });
  });

  it('rejeita WebP explicitamente em vez de incorporá-lo como PNG', () => {
    expect(() => fitImageInBox(webp(), { width: 100, height: 100 })).toThrow(
      UnprocessableEntityException,
    );
  });

  it('limita a concorrência preservando a ordem e propaga a primeira falha', async () => {
    let active = 0;
    let peak = 0;
    const task = async (value: number): Promise<number> => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return value * 2;
    };
    expect(await mapWithConcurrency([1, 2, 3, 4, 5], 2, task)).toEqual([
      2, 4, 6, 8, 10,
    ]);
    expect(peak).toBeLessThanOrEqual(2);

    const limit = createConcurrencyLimiter(2);
    peak = 0;
    await Promise.all(
      [1, 2, 3, 4, 5, 6].map((value) => limit(() => task(value))),
    );
    expect(peak).toBeLessThanOrEqual(2);
    await expect(
      mapWithConcurrency([1, 2], 1, () => Promise.reject(new Error('falhou'))),
    ).rejects.toThrow('falhou');
    await expect(limit(() => Promise.reject(new Error('x')))).rejects.toThrow(
      'x',
    );
    expect(await limit(() => Promise.resolve('livre'))).toBe('livre');
  });

  it('distingue linhas de grade de frases em maiúsculas e de linhas de resposta', () => {
    expect(isWordSearchGridRow('PIXVIÚVAJ')).toBe(true);
    expect(isWordSearchGridRow('J E S U S')).toBe(true);
    expect(isWordSearchGridRow('ENCONTRE AS PALAVRAS')).toBe(false);
    expect(isWordSearchGridRow('A×BC')).toBe(false);
    expect(isPuzzleGridRow('#..1.#')).toBe(true);
    expect(isPuzzleGridRow('______')).toBe(false);
    expect(isPuzzleGridBlock(['....', '....', '....'])).toBe(false);
    expect(isPuzzleGridBlock(['#..1', '....', '2..#'])).toBe(true);
    expect(isPuzzleGridBlock(['ABCD', 'EFGH'])).toBe(false);
  });
});
