import { sharp } from './sharp.utils';
import {
  A4_ASPECT_RATIO,
  A4_ASPECT_TOLERANCE,
  A4_PAD_BACKGROUND_SAMPLE_PX,
  A4_PAD_BACKGROUND_TOLERANCE,
  A4_PAD_EDGE_TRIM_PX,
} from '../constants/lesson-visual-style.constants';

/** Crop box that gives the image the A4 proportion, centred, on its own orientation. */
export function a4CropBox(
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } | null {
  const landscape = width >= height;
  const ratio = landscape ? width / height : height / width;
  if (Math.abs(ratio - A4_ASPECT_RATIO) < A4_ASPECT_TOLERANCE) return null;
  const tooLong = ratio > A4_ASPECT_RATIO;
  // Landscape too long → narrower; portrait too long → shorter; otherwise the other axis.
  const cropWidth = landscape === tooLong;
  const w = cropWidth
    ? Math.round(
        landscape ? height * A4_ASPECT_RATIO : height / A4_ASPECT_RATIO,
      )
    : width;
  const h = cropWidth
    ? height
    : Math.round(landscape ? width / A4_ASPECT_RATIO : width * A4_ASPECT_RATIO);
  return {
    left: Math.floor((width - w) / 2),
    top: Math.floor((height - h) / 2),
    width: w,
    height: h,
  };
}

/**
 * Providers only draw 3:2 or 4:3 images; a full-page visual must print on A4.
 * The prompt keeps a white margin on every edge, so this centred crop only
 * removes empty paper.
 */
export async function cropToA4Proportion(image: Buffer): Promise<Buffer> {
  try {
    const { width, height } = await sharp(image).metadata();
    if (!width || !height) return image;
    const box = a4CropBox(width, height);
    return box ? await sharp(image).extract(box).png().toBuffer() : image;
  } catch {
    // Not a readable image: the upload validation that follows rejects it with its own message.
    return image;
  }
}

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

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

/**
 * Background colour of each column (top/bottom) or row (left/right) next to
 * an edge. A column keeps its own median only while it is close to the
 * colour of the whole strip; where a detail dominates it, the strip colour
 * is used instead, so the detail is never smeared into the new margin.
 */
export function edgeBackground(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  side: 'top' | 'bottom' | 'left' | 'right',
  sample: number,
): Uint8Array {
  const vertical = side === 'top' || side === 'bottom';
  const length = vertical ? width : height;
  const depth = Math.max(1, Math.min(sample, vertical ? height : width));
  const pixel = (i: number, d: number): number => {
    const x = vertical ? i : side === 'left' ? d : width - 1 - d;
    const y = vertical ? (side === 'top' ? d : height - 1 - d) : i;
    return (y * width + x) * channels;
  };
  const strip: number[] = [];
  for (let c = 0; c < channels; c += 1) {
    const histogram = new Array<number>(256).fill(0);
    for (let i = 0; i < length; i += 1)
      for (let d = 0; d < depth; d += 1) histogram[data[pixel(i, d) + c]] += 1;
    let seen = 0;
    const half = (length * depth) / 2;
    strip.push(histogram.findIndex((count) => (seen += count) >= half));
  }
  const out = new Uint8Array(length * channels);
  for (let i = 0; i < length; i += 1) {
    const own: number[] = [];
    for (let c = 0; c < channels; c += 1) {
      const values: number[] = [];
      for (let d = 0; d < depth; d += 1) values.push(data[pixel(i, d) + c]);
      own.push(median(values));
    }
    const distance = Math.max(...own.map((v, c) => Math.abs(v - strip[c])));
    const colour = distance <= A4_PAD_BACKGROUND_TOLERANCE ? own : strip;
    colour.forEach((v, c) => (out[i * channels + c] = v));
  }
  return out;
}

/** The image placed inside a larger canvas whose margins repeat the edge background. */
export function padWithEdgeBackground(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  box: { top: number; bottom: number; left: number; right: number },
  sample: number,
): { data: Uint8Array; width: number; height: number } {
  const outWidth = width + box.left + box.right;
  const outHeight = height + box.top + box.bottom;
  const out = new Uint8Array(outWidth * outHeight * channels);
  const top = edgeBackground(data, width, height, channels, 'top', sample);
  const bottom = edgeBackground(
    data,
    width,
    height,
    channels,
    'bottom',
    sample,
  );
  const left = edgeBackground(data, width, height, channels, 'left', sample);
  const right = edgeBackground(data, width, height, channels, 'right', sample);
  const rowBytes = width * channels;
  for (let y = 0; y < outHeight; y += 1) {
    const iy = y - box.top;
    const rowStart = y * outWidth * channels;
    if (iy >= 0 && iy < height) {
      // Image rows are copied whole; only the side margins are painted.
      for (let x = 0; x < box.left; x += 1)
        out.set(
          left.subarray(iy * channels, iy * channels + channels),
          rowStart + x * channels,
        );
      out.set(
        data.subarray(iy * rowBytes, iy * rowBytes + rowBytes),
        rowStart + box.left * channels,
      );
      for (let x = 0; x < box.right; x += 1)
        out.set(
          right.subarray(iy * channels, iy * channels + channels),
          rowStart + (box.left + width + x) * channels,
        );
      continue;
    }
    const band = iy < 0 ? top : bottom;
    // Corners above/below the side margins take the nearest column's colour.
    for (let x = 0; x < outWidth; x += 1) {
      const cx = Math.min(width - 1, Math.max(0, x - box.left));
      out.set(
        band.subarray(cx * channels, cx * channels + channels),
        rowStart + x * channels,
      );
    }
  }
  return { data: out, width: outWidth, height: outHeight };
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
    if (!box) return inner;
    // Each new margin repeats the background colour next to that edge, so a
    // detail drawn against the edge is neither mirrored nor smeared into it.
    const raw = await sharp(inner)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const padded = padWithEdgeBackground(
      new Uint8Array(raw.data),
      raw.info.width,
      raw.info.height,
      raw.info.channels,
      box,
      A4_PAD_BACKGROUND_SAMPLE_PX,
    );
    return await sharp(Buffer.from(padded.data), {
      raw: {
        width: padded.width,
        height: padded.height,
        channels: raw.info.channels,
      },
    })
      .png()
      .toBuffer();
  } catch {
    // Not a readable image: the upload validation that follows rejects it with its own message.
    return image;
  }
}
