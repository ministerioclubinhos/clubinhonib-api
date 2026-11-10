import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { IDEA_AI } from '../constants';
import { IdeaAiGuard, PreparedIdeaImage, IdeaImageFormat } from '../types';
@Injectable()
export class IdeaImageTransformProvider {
  async prepare(buffer: Buffer): Promise<PreparedIdeaImage> {
    const meta = await sharp(buffer, {
      limitInputPixels: 40_000_000,
    }).metadata();
    const format = meta.format;
    if (
      format !== 'jpeg' &&
      format !== 'png' &&
      format !== 'webp' &&
      format !== 'gif'
    )
      throw new Error('Formato de imagem inválido.');
    return {
      data: await sharp(buffer)
        .rotate()
        .resize({
          width: IDEA_AI.imageSide,
          height: IDEA_AI.imageSide,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer(),
      mimeType: 'image/png',
      name: 'original.png',
      format,
      animated: (meta.pages ?? 1) > 1,
    };
  }
  async deterministic(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .normalise({ lower: 1, upper: 99 })
      .sharpen({ sigma: 0.5 })
      .png()
      .toBuffer();
  }
  async output(buffer: Buffer, format: IdeaImageFormat): Promise<Buffer> {
    return sharp(buffer)
      .resize({
        width: IDEA_AI.imageSide,
        height: IDEA_AI.imageSide,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .toFormat(format)
      .toBuffer();
  }
  async compare(original: Buffer, enhanced: Buffer): Promise<IdeaAiGuard> {
    const [a, b] = await Promise.all([
      sharp(original).metadata(),
      sharp(enhanced).metadata(),
    ]);
    const ratioA = (a.width ?? 0) / (a.height ?? 1);
    const ratioB = (b.width ?? 0) / (b.height ?? 1);
    const violations: string[] = [];
    if (!ratioA || Math.abs(ratioB / ratioA - 1) > IDEA_AI.ratioTolerance)
      violations.push('A proporção da imagem mudou.');
    const [left, right] = await Promise.all(
      [original, enhanced].map((buffer) =>
        sharp(buffer)
          .resize(32, 32, { fit: 'fill' })
          .greyscale()
          .normalise()
          .raw()
          .toBuffer(),
      ),
    );
    const error =
      left.reduce(
        (sum, pixel, index) => sum + Math.abs(pixel - (right[index] ?? 0)),
        0,
      ) /
      (left.length * 255);
    if (1 - error < IDEA_AI.imageSimilarity)
      violations.push('A imagem mudou além do limite de similaridade.');
    return { approved: !violations.length, violations };
  }
}
