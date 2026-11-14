import { PROVIDER_IMAGE } from '../providers/lesson-llm.constants';

/** Minimal bytes carrying a real PNG signature, distinguishable by label. */
export function pngImageFixture(label: string): Buffer {
  return Buffer.concat([
    Buffer.from(PROVIDER_IMAGE.pngSignature),
    Buffer.from(label),
  ]);
}

/** Minimal bytes carrying a real JPEG signature, distinguishable by label. */
export function jpegImageFixture(label: string): Buffer {
  return Buffer.concat([
    Buffer.from(PROVIDER_IMAGE.jpegSignature),
    Buffer.from(label),
  ]);
}
