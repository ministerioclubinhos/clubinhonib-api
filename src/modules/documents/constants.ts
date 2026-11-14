import { MediaTargetType } from 'src/shared/media/media-target-type.enum';

/** Tipo gravado nas mídias do documento. */
export const DOCUMENT_MEDIA_TARGET_TYPE = MediaTargetType.Document;

/**
 * Grafias aceitas na leitura. A edição antiga gravava `'document'` em
 * minúsculas enquanto a criação gravava `'Document'`: procurar só pela grafia
 * atual esconderia parte das mídias e deixaria o arquivo delas no S3 quando o
 * documento fosse removido. Toda escrita usa `DOCUMENT_MEDIA_TARGET_TYPE`, e as
 * linhas antigas são normalizadas na próxima gravação.
 */
export const DOCUMENT_MEDIA_TARGET_TYPES: string[] = [
  MediaTargetType.Document,
  'document',
];

/** Paginação padrão da listagem de documentos. */
export const DOCUMENTS_DEFAULT_PAGE = 1;
export const DOCUMENTS_DEFAULT_LIMIT = 12;
export const DOCUMENTS_MAX_LIMIT = 100;

/** Campos aceitos na ordenação, e o padrão. */
export const DOCUMENT_SORT_FIELDS = ['createdAt', 'name'] as const;

export const DOCUMENT_DEFAULT_SORT = 'createdAt';
export const DOCUMENT_DEFAULT_ORDER = 'DESC';

/** Coluna correspondente a cada campo de ordenação aceito. */
export const DOCUMENT_SORT_COLUMNS = {
  createdAt: 'document.createdAt',
  name: 'document.name',
} as const satisfies Record<(typeof DOCUMENT_SORT_FIELDS)[number], string>;

/** Tamanho máximo do texto de busca. */
export const DOCUMENT_SEARCH_MAX_LENGTH = 200;

/** Campo multipart que carrega o JSON das requisições de criação/edição. */
export const DOCUMENT_PAYLOAD_FIELD = 'documentData';

/** Prefixo do caminho público gerado para cada documento. */
export const DOCUMENT_ROUTE_PREFIX = 'documento_';
