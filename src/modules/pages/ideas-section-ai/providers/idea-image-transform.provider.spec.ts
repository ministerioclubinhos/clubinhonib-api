import { IdeaImageTransformProvider } from './idea-image-transform.provider';
import { sharp } from 'src/modules/ai-lessons/utils/sharp.utils';

/**
 * Usa o sharp de verdade: a falha que escondia o tratamento de imagens
 * (`sharp_1.default is not a function`, porque a build é CommonJS sem
 * esModuleInterop) só aparece sem mocks.
 */
describe('IdeaImageTransformProvider (sharp real)', () => {
  const provider = new IdeaImageTransformProvider();
  let page: Buffer;

  beforeAll(async () => {
    page = await sharp({
      create: {
        width: 300,
        height: 200,
        channels: 3,
        background: { r: 200, g: 80, b: 80 },
      },
    })
      .png()
      .toBuffer();
  });

  it('prepares, adjusts and compares an image without failing on the import', async () => {
    const prepared = await provider.prepare(page);
    expect(prepared.format).toBe('png');
    const adjusted = await provider.deterministic(page);
    const verdict = await provider.compare(page, adjusted);
    expect(verdict.approved).toBe(true);
  });

  it('turns a page into a JPEG with the size it had', async () => {
    const result = await provider.toJpeg(page, 90);
    expect(result).toMatchObject({ width: 300, height: 200 });
    expect(result.jpeg.subarray(0, 2).toString('hex')).toBe('ffd8');
  });
});
