export const OWNED_ASSET_URLS_FIELD = '_ownedAssetUrls';

/** Structured-data lists whose items carry server-generated `url`s. */
export const LESSON_ASSET_LIST_FIELDS = ['assets', 'printableAssets'] as const;

/** `<Date.now()>_<uuid8>_` prefix added by `AwsS3Service.upload`. */
export const S3_UPLOAD_KEY_PREFIX_PATTERN = /^\d{10,}_[0-9a-f]{8}_/;
