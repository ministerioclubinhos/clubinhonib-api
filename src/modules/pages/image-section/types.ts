import { IMAGE_SECTION_SORT_FIELDS } from './constants';

/** Campo pelo qual a fila pode ser ordenada. */
export type ImageSectionSortField = (typeof IMAGE_SECTION_SORT_FIELDS)[number];

/** Direção da ordenação. */
export type ImageSectionSortOrder = 'ASC' | 'DESC';

/** Situação da foto na revisão. */
export type ImageSectionStatus = 'pending' | 'approved';

/** Arquivos do multipart, endereçados pelo nome do campo. */
export type UploadedFilesDict = Record<string, Express.Multer.File>;
