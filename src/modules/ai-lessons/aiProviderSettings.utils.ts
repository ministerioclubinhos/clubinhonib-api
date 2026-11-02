import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { AppValidationException, ErrorCode } from 'src/shared/exceptions';
import { LessonLlmProvider } from './providers/lesson-llm.types';

const ENCRYPTED_SECRET_PREFIX = 'enc:v1:';

function deriveEncryptionKey(secret: string): Buffer {
  return createHash('sha256').update(secret, 'utf8').digest();
}

export function encryptProviderSecret(
  rawSecret: string,
  encryptionKey = process.env.AI_PROVIDER_SETTINGS_ENCRYPTION_KEY,
): string {
  const trimmed = typeof rawSecret === 'string' ? rawSecret.trim() : '';
  if (!trimmed) return '';
  if (trimmed.startsWith(ENCRYPTED_SECRET_PREFIX)) return trimmed;
  const masterKey =
    typeof encryptionKey === 'string' ? encryptionKey.trim() : '';
  if (!masterKey) return trimmed;
  const key = deriveEncryptionKey(masterKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(trimmed, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${ENCRYPTED_SECRET_PREFIX}${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`;
}

export function decryptProviderSecret(
  storedValue: unknown,
  encryptionKey = process.env.AI_PROVIDER_SETTINGS_ENCRYPTION_KEY,
): string {
  if (typeof storedValue !== 'string' || !storedValue.trim()) return '';
  const trimmed = storedValue.trim();
  if (!trimmed.startsWith(ENCRYPTED_SECRET_PREFIX)) return trimmed;
  const masterKey =
    typeof encryptionKey === 'string' ? encryptionKey.trim() : '';
  if (!masterKey) return '';
  const payload = trimmed.slice(ENCRYPTED_SECRET_PREFIX.length);
  const [ivB64, tagB64, cipherB64] = payload.split(':');
  if (!ivB64 || !tagB64 || !cipherB64) return '';
  try {
    const key = deriveEncryptionKey(masterKey);
    const decipher = createDecipheriv(
      'aes-256-gcm',
      key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
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
