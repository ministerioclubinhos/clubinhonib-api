import * as sharpModule from 'sharp';

type SharpFactory = typeof sharpModule.default;

/**
 * sharp's typings only describe its ES default export, but under this
 * project's CommonJS build (no esModuleInterop) `require('sharp')` is the
 * factory itself and `.default` is undefined. Use this instead of
 * `import sharp from 'sharp'`, which compiles to `sharp_1.default(...)`.
 */
export const sharp: SharpFactory =
  (sharpModule as unknown as { default?: SharpFactory }).default ??
  (sharpModule as unknown as SharpFactory);
