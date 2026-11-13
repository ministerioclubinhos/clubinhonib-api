import { sharp } from './sharp.utils';
import {
  A4_ASPECT_RATIO,
  A4_ASPECT_TOLERANCE,
  A4_PAD_EDGE_TRIM_PX,
} from '../constants/lesson-visual-style.constants';

/** Edges to add so the image reaches the A4 proportion without losing any of it. */
export function a4PadBox(
  width: number,
  height: number,
): { top: number; bottom: number; left: number; right: number } | null {
  const landscape = width >= height;
  const ratio = landscape ? width / height : height / width;
  if (Math.abs(ratio - A4_ASPECT_RATIO) < A4_ASPECT_TOLERANCE) return null;
  const tooLong = ratio > A4_ASPECT_RATIO;
  // Landscape too long → taller; portrait too long → wider; otherwise the other axis.
  const growHeight = landscape === tooLong;
  const extra = growHeight
    ? Math.round(
        (landscape ? width / A4_ASPECT_RATIO : width * A4_ASPECT_RATIO) -
          height,
      )
    : Math.round(
        (landscape ? height * A4_ASPECT_RATIO : height / A4_ASPECT_RATIO) -
          width,
      );
  const first = Math.floor(extra / 2);
  const second = extra - first;
  return growHeight
    ? { top: first, bottom: second, left: 0, right: 0 }
    : { top: 0, bottom: 0, left: first, right: second };
}

/**
 * Full-bleed cards keep every pixel the provider drew: the background is
 * extended (edge pixels repeated) until the image has the A4 proportion, so
 * text near an edge is never cut.
 */
export async function padToA4Proportion(image: Buffer): Promise<Buffer> {
  try {
    const { width, height } = await sharp(image).metadata();
    if (!width || !height) return image;
    // Providers often leave a 1-px line or vignette on the edge; extending it
    // would turn it into a visible band, so it is dropped first.
    const trim = A4_PAD_EDGE_TRIM_PX;
    const inner = await sharp(image)
      .extract({
        left: trim,
        top: trim,
        width: width - trim * 2,
        height: height - trim * 2,
      })
      .png()
      .toBuffer();
    const box = a4PadBox(width - trim * 2, height - trim * 2);
    return box
      ? await sharp(inner)
          .extend({ ...box, extendWith: 'mirror' })
          .png()
          .toBuffer()
      : inner;
  } catch {
    // Not a readable image: the upload validation that follows rejects it with its own message.
    return image;
  }
}
