import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'node:crypto';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { LessonLlmProvider } from './providers/lesson-llm.types';
import {
  AI_PROVIDER_SECRET,
  AiProviderSecretFailure,
} from './constants/ai-provider-settings.constants';
import { ProviderSecretKeys } from './types/ai-provider-settings.types';

/** Raised when a stored secret exists but cannot be read with the configured keys. */
export class ProviderSecretError extends Error {
  constructor(readonly reason: AiProviderSecretFailure) {
    super(reason);
  }
}

export function providerSecretKeysFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): ProviderSecretKeys {
  const read = (name: string): string => (env[name] ?? '').trim();
  return {
    current: read(AI_PROVIDER_SECRET.currentKeyEnv),
    previous: read(AI_PROVIDER_SECRET.previousKeyEnv),
  };
}

export function isEncryptedProviderSecret(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    (value.trim().startsWith(AI_PROVIDER_SECRET.prefixV1) ||
      value.trim().startsWith(AI_PROVIDER_SECRET.prefixV2))
  );
}

export function providerSecretKeyId(masterKey: string): string {
  return createHash('sha256')
    .update(`${AI_PROVIDER_SECRET.keyIdContext}${masterKey}`, 'utf8')
    .digest('hex')
    .slice(0, AI_PROVIDER_SECRET.keyIdLength);
}

function deriveLegacyKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

function deriveKey(secret: string, salt: Buffer): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(secret, 'utf8'),
      salt,
      AI_PROVIDER_SECRET.hkdfInfo,
      32,
    ),
  );
}

function open(
  key: Buffer,
  iv: string,
  tag: string,
  cipherText: string,
  aad?: string,
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(iv, 'base64'),
  );
  if (aad) decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherText, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Encrypts a provider secret as `enc:v2:<kid>:<salt>:<iv>:<tag>:<cipher>`.
 * The provider name is bound as AAD so a ciphertext cannot be moved between rows.
 * Without a master key the value is returned unchanged (callers decide whether
 * plaintext storage is acceptable).
 */
export function encryptProviderSecret(
  rawSecret: string,
  provider: string,
  keys: ProviderSecretKeys = providerSecretKeysFromEnv(),
): string {
  const trimmed = typeof rawSecret === 'string' ? rawSecret.trim() : '';
  if (!trimmed) return '';
  if (!keys.current) return trimmed;
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    deriveKey(keys.current, salt),
    iv,
  );
  cipher.setAAD(Buffer.from(provider, 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(trimmed, 'utf8'),
    cipher.final(),
  ]);
  return `${AI_PROVIDER_SECRET.prefixV2}${[
    providerSecretKeyId(keys.current),
    salt.toString('base64'),
    iv.toString('base64'),
    cipher.getAuthTag().toString('base64'),
    encrypted.toString('base64'),
  ].join(':')}`;
}

/**
 * Reads a stored secret: legacy plaintext, `enc:v1` (sha256 key, no AAD) or
 * `enc:v2`. Throws {@link ProviderSecretError} instead of returning an empty
 * string, so callers never mistake an unreadable secret for an absent one.
 */
export function decryptProviderSecret(
  storedValue: unknown,
  provider: string,
  keys: ProviderSecretKeys = providerSecretKeysFromEnv(),
): string {
  if (typeof storedValue !== 'string' || !storedValue.trim()) return '';
  const trimmed = storedValue.trim();
  if (!isEncryptedProviderSecret(trimmed)) return trimmed;
  const candidates = [keys.current, keys.previous].filter(Boolean);
  if (!candidates.length)
    throw new ProviderSecretError(AiProviderSecretFailure.MASTER_KEY_MISSING);
  if (trimmed.startsWith(AI_PROVIDER_SECRET.prefixV1)) {
    const [iv, tag, cipherText] = trimmed
      .slice(AI_PROVIDER_SECRET.prefixV1.length)
      .split(':');
    if (!iv || !tag || !cipherText)
      throw new ProviderSecretError(AiProviderSecretFailure.MALFORMED);
    for (const candidate of candidates) {
      try {
        return open(deriveLegacyKey(candidate), iv, tag, cipherText);
      } catch {
        // Try the previous key before reporting the failure.
      }
    }
    throw new ProviderSecretError(AiProviderSecretFailure.DECRYPT_FAILED);
  }
  const [keyId, salt, iv, tag, cipherText] = trimmed
    .slice(AI_PROVIDER_SECRET.prefixV2.length)
    .split(':');
  if (!keyId || !salt || !iv || !tag || !cipherText)
    throw new ProviderSecretError(AiProviderSecretFailure.MALFORMED);
  const matching = candidates.filter(
    (candidate) => providerSecretKeyId(candidate) === keyId,
  );
  if (!matching.length)
    throw new ProviderSecretError(AiProviderSecretFailure.UNKNOWN_KEY_ID);
  for (const candidate of matching) {
    try {
      return open(
        deriveKey(candidate, Buffer.from(salt, 'base64')),
        iv,
        tag,
        cipherText,
        provider,
      );
    } catch {
      // Reported below.
    }
  }
  throw new ProviderSecretError(AiProviderSecretFailure.DECRYPT_FAILED);
}

/** True when the stored value should be rewritten with the current key/format. */
export function providerSecretNeedsRotation(
  storedValue: unknown,
  keys: ProviderSecretKeys = providerSecretKeysFromEnv(),
): boolean {
  if (typeof storedValue !== 'string' || !storedValue.trim() || !keys.current)
    return false;
  const trimmed = storedValue.trim();
  if (!trimmed.startsWith(AI_PROVIDER_SECRET.prefixV2)) return true;
  return (
    trimmed.slice(AI_PROVIDER_SECRET.prefixV2.length).split(':')[0] !==
    providerSecretKeyId(keys.current)
  );
}

export function providerSettingString(
  value: unknown,
  fallback: string,
): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function providerSettingInteger(
  value: unknown,
  fallback: number,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function parseLessonProvider(value: unknown): LessonLlmProvider {
  const normalized =
    typeof value === 'string' ? value.trim().toLowerCase() : value;
  if (
    normalized === LessonLlmProvider.OPENAI ||
    normalized === LessonLlmProvider.GEMINI
  )
    return normalized;
  throw new AppValidationException(
    ErrorCode.VALIDATION_ERROR,
    'Provedor de IA inválido. Escolha OpenAI ou Gemini.',
  );
}
