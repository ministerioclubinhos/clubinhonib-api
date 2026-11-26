export const OLDER_MEDITATION_REQUEST = {
  maxOutputTokens: 4096,
  maxRetries: 2,
  maxDelayMs: 60000,
  fallbackDelayMs: 1000,
  jitterMs: 250,
} as const;
