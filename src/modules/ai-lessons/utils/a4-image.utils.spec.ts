import { sharp } from './sharp.utils';
import { A4_ASPECT_RATIO } from '../constants/lesson-visual-style.constants';
import { a4PadBox, padToA4Proportion } from './a4-image.utils';

describe('padToA4Proportion (cartões do versículo sem borda)', () => {
  it('estende em cima e embaixo um cartão 3:2 sem cortar nada', async () => {
    expect(a4PadBox(1536, 1024)).toEqual({
      top: 31,
      bottom: 31,
      left: 0,
      right: 0,
    });
    const card = await sharp({
      create: {
        width: 1536,
        height: 1024,
        channels: 3,
        background: { r: 250, g: 240, b: 195 },
      },
    })
      .png()
      .toBuffer();
    const padded = await sharp(await padToA4Proportion(card)).metadata();
    // 4 px are dropped from each edge before extending: 1528 × 1016 → 1528 × 1080.
    expect(padded.width).toBe(1528);
    expect(padded.height).toBe(1080);
    expect(padded.width / padded.height).toBeCloseTo(A4_ASPECT_RATIO, 2);
  });

  it('não mexe em imagem que já está em A4', () => {
    expect(a4PadBox(1448, 1024)).toBeNull();
  });
});

describe('padToA4Proportion não transforma a linha da borda em faixa', () => {
  it('descarta a linha clara da borda antes de estender o fundo', async () => {
    const width = 300;
    const height = 200;
    const raw = Buffer.alloc(width * height * 3, 100);
    // a light 1-px line on the top edge, like the provider sometimes draws
    raw.fill(250, 0, width * 3);
    const card = await sharp(raw, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const { data, info } = await sharp(await padToA4Proportion(card))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width / info.height).toBeCloseTo(A4_ASPECT_RATIO, 1);
    expect(data[0]).toBe(100);
  });
});
