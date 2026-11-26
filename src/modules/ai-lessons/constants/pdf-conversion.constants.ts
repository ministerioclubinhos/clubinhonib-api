export const PDF_CONVERTER_BINARY = 'soffice';
/** Preferred environment variable for the conversion concurrency. */
export const PDF_CONVERSION_CONCURRENCY_ENV = 'PDF_CONVERSION_MAX_CONCURRENCY';
/** Former name, still honoured so existing deployments keep their value. */
export const PDF_CONVERSION_CONCURRENCY_LEGACY_ENV =
  'AI_LESSONS_MAX_PDF_CONVERSIONS';
export const PDF_CONVERSION_DEFAULT_CONCURRENCY = 2;
/** Conversions allowed to wait for a slot; beyond it the request fails fast. */
export const PDF_CONVERSION_DEFAULT_MAX_QUEUED = 16;
export const PDF_CONVERSION_QUEUE_TIMEOUT_MS = 60_000;
export const PDF_CONVERSION_TIMEOUT_MS = 90_000;
export const PDF_CONVERSION_STDERR_LIMIT_BYTES = 1024 * 1024;
export const PDF_CONVERSION_VERSION_CHECK_TIMEOUT_MS = 20_000;
/** Converted PDFs of immutable versions kept in memory, least recently used first out. */
export const PDF_CONVERSION_CACHE_MAX_ENTRIES = 48;
export const PDF_CONVERSION_CACHE_MAX_BYTES = 96 * 1024 * 1024;
export const PDF_FILE_SIGNATURE = '%PDF-';
