/** Paginação da listagem do Play. */
export const PLAY_DEFAULT_PAGE = 1;
export const PLAY_DEFAULT_LIMIT = 12;
export const PLAY_MAX_LIMIT = 50;

/** Tamanho máximo do texto de busca. */
export const PLAY_SEARCH_MAX_LENGTH = 200;

/** Maior valor aceito para a posição de um vídeo. */
export const PLAY_MAX_POSITION = 9999;

/** Nomes legíveis dos campos do Play nas mensagens de validação. */
export const PLAY_FIELD_LABELS: Record<string, string> = {
  play: 'Clubinho Play',
  scope: 'Modo no Play',
  inPlay: 'No Play',
  featured: 'Destaque',
  position: 'Posição',
};

/** Maior posição possível; vídeos sem posição ordenam depois dos numerados. */
export const PLAY_POSITION_UNSET_SORT = 2147483647;

/** Miniatura enviada pelo admin: só imagem, até este tamanho. */
export const PLAY_THUMBNAIL_MAX_BYTES = 2 * 1024 * 1024;
export const PLAY_THUMBNAIL_MIME_PREFIX = 'image/';

/** Maior duração aceita (24 h), em segundos. */
export const PLAY_MAX_DURATION_SECONDS = 86_400;

/** Uma nova visualização do mesmo professor só conta após esta janela. */
export const PLAY_VIEW_DEDUPE_MINUTES = 30;

/** A partir desta fração assistida o vídeo conta como concluído. */
export const PLAY_COMPLETED_RATIO = 0.95;

/** Tamanho máximo da fila "Tocar tudo" / "Aleatório". */
export const PLAY_QUEUE_MAX = 200;

/** Tamanhos da home e dos relacionados. */
export const PLAY_HOME_ROW_SIZE = 12;
export const PLAY_HOME_FEATURED_SIZE = 5;
export const PLAY_HOME_MAX_CATEGORY_ROWS = 5;
export const PLAY_HOME_MAX_GALLERY_ROWS = 5;
export const PLAY_RELATED_DEFAULT_LIMIT = 12;
export const PLAY_RELATED_MAX_LIMIT = 30;

/** Categorias. */
export const PLAY_CATEGORY_NAME_MAX_LENGTH = 100;
export const PLAY_STATS_MAX_LIMIT = 100;
export const PLAY_STATS_DEFAULT_LIMIT = 20;
