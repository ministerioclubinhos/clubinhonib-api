import {
  LESSON_ASSET_LIST_FIELDS,
  OWNED_ASSET_URLS_FIELD,
  S3_UPLOAD_KEY_PREFIX_PATTERN,
} from '../constants/lesson-asset.constants';
import {
  assertSafeImageUrl,
  isPathStyleS3Host,
  isVirtualHostedBucketHost,
} from './asset-url.utils';

type JsonObject = Record<string, unknown>;

export { OWNED_ASSET_URLS_FIELD } from '../constants/lesson-asset.constants';

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function extractLessonS3Key(
  urlString: string,
  bucketName?: string,
): string | null {
  let parsed: URL;
  try {
    parsed = assertSafeImageUrl(urlString);
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname.endsWith('.amazonaws.com')) return null;

  const decodedPath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
  if (!decodedPath || decodedPath.includes('..')) return null;

  if (!bucketName) {
    return decodedPath;
  }

  const pathPrefix = `${bucketName}/`;
  if (isVirtualHostedBucketHost(hostname, bucketName)) {
    return decodedPath;
  }
  if (isPathStyleS3Host(hostname) && decodedPath.startsWith(pathPrefix)) {
    return decodedPath.slice(pathPrefix.length);
  }
  return null;
}

export function attachOwnedAssetUrls(
  content: JsonObject,
  uploadedUrls: readonly string[],
): JsonObject {
  const existing = Array.isArray(content[OWNED_ASSET_URLS_FIELD])
    ? content[OWNED_ASSET_URLS_FIELD].filter(
        (item): item is string =>
          typeof item === 'string' && Boolean(item.trim()),
      )
    : [];
  const merged = Array.from(
    new Set([
      ...existing,
      ...uploadedUrls.filter(
        (item): item is string =>
          typeof item === 'string' && Boolean(item.trim()),
      ),
    ]),
  );
  return {
    ...content,
    [OWNED_ASSET_URLS_FIELD]: merged,
  };
}

/**
 * Studio uploads are named `<lessonId>-<STAGE>-<assetId>.<ext>` and stored by
 * `AwsS3Service.upload` as `<env>/uploads/<timestamp>_<uuid8>_<that name>`.
 * The bare `<lessonId>-...` basename is accepted for legacy objects.
 */
export function isLessonOwnedS3Key(lessonId: string, key: string): boolean {
  const normalizedLessonId = lessonId.trim();
  if (!normalizedLessonId) return false;
  const baseName = key.split('/').pop() ?? key;
  const originalName = baseName.replace(S3_UPLOAD_KEY_PREFIX_PATTERN, '');
  return originalName.startsWith(`${normalizedLessonId}-`);
}

export function isLessonOwnedAssetUrl(
  lessonId: string,
  url: string,
  bucketName?: string,
): boolean {
  const key = extractLessonS3Key(url, bucketName);
  if (!key) return false;
  return isLessonOwnedS3Key(lessonId, key);
}

export function extractOwnedLessonVersionAssetUrls(
  lessonId: string,
  version: {
    docxS3Key?: string | null;
    pdfS3Key?: string | null;
    structuredDataJson?: Record<string, unknown> | null;
  },
  bucketName?: string,
): string[] {
  const owned = new Set<string>();

  // Every candidate, the DOCX/PDF pointers included, must carry this lesson's
  // prefix: a URL of another object of the same bucket is never "owned".
  const addIfAuthorizedOwned = (candidate: unknown): void => {
    if (typeof candidate !== 'string' || !candidate.trim()) return;
    const key = extractLessonS3Key(candidate, bucketName);
    if (!key || !isLessonOwnedS3Key(lessonId, key)) return;
    owned.add(candidate.trim());
  };

  addIfAuthorizedOwned(version.docxS3Key);
  addIfAuthorizedOwned(version.pdfS3Key);

  const structured = asObject(version.structuredDataJson);
  const explicitOwned = Array.isArray(structured[OWNED_ASSET_URLS_FIELD])
    ? structured[OWNED_ASSET_URLS_FIELD]
    : [];
  for (const url of explicitOwned) {
    addIfAuthorizedOwned(url);
  }

  for (const listKey of LESSON_ASSET_LIST_FIELDS) {
    const items = Array.isArray(structured[listKey])
      ? (structured[listKey] as unknown[])
      : [];
    for (const item of items) {
      const asset = asObject(item);
      addIfAuthorizedOwned(asset.url);
    }
  }

  return [...owned];
}

export function preserveServerOwnedAssetsOnManualSave(
  previousStructured: JsonObject | null | undefined,
  candidateStructured: JsonObject,
): JsonObject {
  const previous = asObject(previousStructured);
  const next: JsonObject = { ...candidateStructured };

  if (Array.isArray(previous[OWNED_ASSET_URLS_FIELD])) {
    next[OWNED_ASSET_URLS_FIELD] = previous[OWNED_ASSET_URLS_FIELD].filter(
      (item): item is string => typeof item === 'string',
    );
  } else {
    delete next[OWNED_ASSET_URLS_FIELD];
  }

  for (const listKey of LESSON_ASSET_LIST_FIELDS) {
    if (Array.isArray(previous[listKey])) {
      const prevAssets = (previous[listKey] as unknown[]).map(asObject);
      const candidateAssets = Array.isArray(next[listKey])
        ? (next[listKey] as unknown[]).map(asObject)
        : prevAssets;
      next[listKey] = prevAssets.map((prevAsset, index) => {
        const candidateAsset = candidateAssets[index] ?? prevAsset;
        return {
          ...prevAsset,
          ...(typeof candidateAsset.instruction === 'string'
            ? { instruction: candidateAsset.instruction }
            : {}),
          url: prevAsset.url,
        };
      });
    } else if (listKey in next) {
      delete next[listKey];
    }
  }

  return next;
}
