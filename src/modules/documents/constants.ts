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
