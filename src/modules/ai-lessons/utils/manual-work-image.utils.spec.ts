import { MANUAL_WORK_LAYOUT as L } from '../constants/manual-work-layout.constants';
import { fitManualWorkArt } from './manual-work-image.utils';
import { sharp } from './sharp.utils';

describe('manual work artwork spanning the frame width', () => {
  const art = (width: number, height: number, margin: number) =>
    sharp({
      create: {
        width: width - 2 * margin,
        height: height - 2 * margin,
        channels: 3,
        background: '#000000',
      },
    })
      .extend({
        top: margin,
        bottom: margin,
        left: margin,
        right: margin,
        background: '#ffffff',
      })
      .png()
      .toBuffer();
  const size = async (image: Buffer) => {
    const { width, height } = await sharp(image).metadata();
    return { width, height };
  };

  it('trims the white paper and cuts a 3:2 drawing to the proportion of the frame', async () => {
    const boxHeight = 400;
    const fitted = await size(
      await fitManualWorkArt(await art(1536, 1024, 40), boxHeight),
    );
    expect(fitted.width).toBe(1456);
    expect(fitted.width / fitted.height).toBeCloseTo(
      L.imageMaximumWidth / boxHeight,
      1,
    );
  });
  it('never cuts more than the allowed share of a tall drawing', async () => {
    const fitted = await size(
      await fitManualWorkArt(await art(1000, 1000, 0), 300),
    );
    expect(fitted.height).toBe(Math.round(1000 * (1 - L.maximumCropShare)));
  });
  it('keeps a drawing already wider than the frame and survives unreadable data', async () => {
    expect(
      await size(await fitManualWorkArt(await art(2000, 500, 0), 400)),
    ).toEqual({ width: 2000, height: 500 });
    const broken = Buffer.from('not an image');
    expect(await fitManualWorkArt(broken, 400)).toBe(broken);
  });
});
