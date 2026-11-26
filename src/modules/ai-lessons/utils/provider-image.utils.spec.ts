import {
  jpegImageFixture,
  pngImageFixture,
} from '../fixtures/provider-image.fixture';
import { PROVIDER_IMAGE } from '../providers/lesson-llm.constants';
import {
  decodeProviderImage,
  detectProviderImage,
} from './provider-image.utils';

describe('provider image validation', () => {
  it('identifies PNG and JPEG by signature, not by declared type', () => {
    expect(detectProviderImage(pngImageFixture('a'))).toEqual({
      mimeType: 'image/png',
      extension: 'png',
    });
    expect(detectProviderImage(jpegImageFixture('a'))).toEqual({
      mimeType: 'image/jpeg',
      extension: 'jpg',
    });
  });

  it('rejects empty, oversized and non-image payloads', () => {
    expect(() => detectProviderImage(Buffer.alloc(0))).toThrow('imagem vazia');
    expect(() =>
      detectProviderImage(
        Buffer.concat([
          pngImageFixture(''),
          Buffer.alloc(PROVIDER_IMAGE.maxBytes),
        ]),
      ),
    ).toThrow('acima do tamanho permitido');
    expect(() =>
      decodeProviderImage(Buffer.from('RIFFxxxxWEBP').toString('base64')),
    ).toThrow('não é uma imagem PNG ou JPEG válida');
  });
});
