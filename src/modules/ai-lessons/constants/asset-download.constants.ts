/** Hard ceiling for one Studio image embedded into a DOCX/PDF. */
export const DEFAULT_MAX_IMAGE_ASSET_BYTES = 15 * 1024 * 1024;
/** Socket inactivity timeout of one image download. */
export const DEFAULT_IMAGE_DOWNLOAD_TIMEOUT_MS = 15_000;
/** Absolute duration of one image download, slow-drip responses included. */
export const DEFAULT_IMAGE_DOWNLOAD_TOTAL_TIMEOUT_MS = 45_000;
/** Simultaneous image downloads while one document is being built. */
export const IMAGE_DOWNLOAD_CONCURRENCY = 4;

export const ASSET_FORBIDDEN_HOSTNAMES: ReadonlySet<string> = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

export const ASSET_FORBIDDEN_HOSTNAME_SUFFIXES: readonly string[] = [
  '.localhost',
  '.local',
  '.internal',
];

export const ASSET_ALLOWED_PORTS: ReadonlySet<string> = new Set([
  '',
  '80',
  '443',
]);
