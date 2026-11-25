import type { PayloadLabels } from 'src/shared/media/payload-validation';

/** Campo multipart com o JSON do envio e os campos dos arquivos. */
export const PLAY_SUBMISSION_PAYLOAD_FIELD = 'submissionData';
export const PLAY_SUBMISSION_VIDEO_FIELD = 'video';
export const PLAY_SUBMISSION_THUMBNAIL_FIELD = 'thumbnail';

/** Mesmo teto de vídeo das demais telas de envio do projeto. */
export const PLAY_SUBMISSION_MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const PLAY_SUBMISSION_UPLOAD_LIMITS = {
  files: 2,
  fileSize: PLAY_SUBMISSION_MAX_VIDEO_BYTES,
  fields: 2,
};
export const PLAY_SUBMISSION_VIDEO_MIME_PREFIX = 'video/';

export const PLAY_SUBMISSION_TITLE_MAX_LENGTH = 255;
export const PLAY_SUBMISSION_DESCRIPTION_MAX_LENGTH = 2000;
export const PLAY_SUBMISSION_REASON_MAX_LENGTH = 500;

/** Quantos envios pendentes cada pessoa pode ter ao mesmo tempo. */
export const PLAY_SUBMISSION_MAX_PENDING_PER_USER = 10;

export const PLAY_SUBMISSIONS_DEFAULT_PAGE = 1;
export const PLAY_SUBMISSIONS_DEFAULT_LIMIT = 12;
export const PLAY_SUBMISSIONS_MAX_LIMIT = 50;
export const PLAY_SUBMISSIONS_MINE_LIMIT = 100;

export const PLAY_SUBMISSION_LABELS: PayloadLabels = {
  page: 'Envio',
  item: { property: 'items', label: 'Vídeo' },
  fields: {
    title: 'Título',
    description: 'Descrição',
    uploadType: 'Tipo de envio',
    url: 'Link',
    durationSeconds: 'Duração',
  },
};
