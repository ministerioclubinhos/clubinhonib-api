export const PHOTO_COMMENT_MAX_LENGTH = 1000;
export const PHOTO_COMMENT_REASON_MAX_LENGTH = 500;
export const PHOTO_COMMENT_SEARCH_MAX_LENGTH = 200;
export const PHOTO_COMMENT_DEFAULT_PAGE = 1;
export const PHOTO_COMMENT_DEFAULT_LIMIT = 10;
export const PHOTO_COMMENT_MAX_LIMIT = 50;
export const PHOTO_COMMENT_RATE_WINDOW_MS = 60_000;
export const PHOTO_COMMENT_RATE_LIMIT = 5;

export const PHOTO_COMMENT_FEED_PATH = '/feed-clubinho';

/** Quantos avisos a leitura em lote atualiza por instrução, dentro da mesma transação. */
export const PHOTO_COMMENT_NOTIFICATION_READ_BATCH_SIZE = 500;
/** Quantos avisos não lidos recentes o resumo expõe (apenas IDs e datas). */
export const PHOTO_COMMENT_NOTIFICATION_RECENT_LIMIT = 10;
