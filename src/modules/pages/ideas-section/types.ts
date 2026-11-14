import { IDEAS_SECTION_SORT_FIELDS } from './constants';

/** Campo pelo qual a fila pode ser ordenada. */
export type IdeasSectionSortField = (typeof IDEAS_SECTION_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type IdeasSectionSortOrder = 'ASC' | 'DESC';

/** Arquivos do multipart, endereçados pelo nome do campo. */
export type UploadedFilesDict = Record<string, Express.Multer.File>;

export type IdeasFormatMap = Readonly<Record<string, readonly string[]>>;
