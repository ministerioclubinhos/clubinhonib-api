import { sharp } from './sharp.utils';
import { A4_ASPECT_RATIO } from '../constants/lesson-visual-style.constants';
import {
  a4CropBox,
  a4PadBox,
  cropToA4Proportion,
  padToA4Proportion,
} from './a4-image.utils';

const blank = (width: number, height: number) =>
  sharp({
    create: { width, height, channels: 3, background: '#ffffff' },
  })
    .png()
    .toBuffer();

describe('proporção A4 das imagens de página inteira', () => {
  it('corta nas laterais a imagem 3:2 da OpenAI e em cima e embaixo a 4:3 do Gemini', () => {
    expect(a4CropBox(1536, 1024)).toEqual({
      left: 44,
      top: 0,
      width: 1448,
      height: 1024,
    });
    expect(a4CropBox(1024, 1536)).toEqual({
      left: 0,
      top: 44,
      width: 1024,
      height: 1448,
    });
    expect(a4CropBox(1200, 900)?.height).toBe(
      Math.round(1200 / A4_ASPECT_RATIO),
    );
  });

  it('não mexe em imagem que já está na proporção do A4', () => {
    expect(a4CropBox(1414, 1000)).toBeNull();
  });

  it('entrega a imagem recortada na proporção do A4', async () => {
    const cropped = await cropToA4Proportion(await blank(1536, 1024));
    const { width, height } = await sharp(cropped).metadata();
    expect(width / height).toBeCloseTo(A4_ASPECT_RATIO, 2);
  });

  it('devolve intacto o que não é imagem legível', async () => {
    const notImage = Buffer.from('não é imagem');
    await expect(cropToA4Proportion(notImage)).resolves.toBe(notImage);
  });
});

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

describe('padToA4Proportion não copia detalhe encostado na borda', () => {
  it('preenche a margem nova com a cor do fundo, não com o desenho', async () => {
    const width = 300;
    const height = 200;
    const raw = Buffer.alloc(width * height * 3, 0);
    for (let i = 0; i < width * height; i += 1) {
      raw[i * 3] = 240; // fundo coral
      raw[i * 3 + 1] = 90;
      raw[i * 3 + 2] = 60;
    }
    // detalhe (pergaminho) encostado na borda de baixo, à direita
    // mais alto que a faixa de amostra (40 px), como um pergaminho grande
    for (let y = 130; y < height; y += 1)
      for (let x = 260; x < 290; x += 1) {
        raw[(y * width + x) * 3] = 250;
        raw[(y * width + x) * 3 + 1] = 230;
        raw[(y * width + x) * 3 + 2] = 160;
      }
    const card = await sharp(raw, { raw: { width, height, channels: 3 } })
      .png()
      .toBuffer();
    const { data, info } = await sharp(await padToA4Proportion(card))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.width / info.height).toBeCloseTo(A4_ASPECT_RATIO, 1);
    // última linha, na coluna do detalhe: tem de ser o fundo, não o pergaminho
    const last = ((info.height - 1) * info.width + 270) * info.channels;
    expect([data[last], data[last + 1], data[last + 2]]).toEqual([240, 90, 60]);
  });
});
