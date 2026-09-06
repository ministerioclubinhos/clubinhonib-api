/**
 * Montagem de itens de mídia (`MediaItemDto`) e dos arquivos do multipart.
 *
 * Um upload declara `uploadType: 'upload'`, `isLocalFile: true` e o
 * `fieldKey` do campo multipart que carrega o arquivo; um link declara
 * `uploadType: 'link'`, `isLocalFile: false` e a `url`.
 */
const { fixture } = require('./fixtures');

const YOUTUBE_URLS = [
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'https://www.youtube.com/watch?v=9bZkp7q19f0',
  'https://youtu.be/kJQP7kiw5Fk',
];

const MEDIA_TYPE_BY_KIND = { png: 'image', jpg: 'image', mp4: 'video', mp3: 'audio', wav: 'audio', pdf: 'document', docx: 'document', txt: 'document', csv: 'document' };

function linkMedia({ mediaType = 'video', url, platformType = 'youtube', title = 'Vídeo (link)', description = 'Link externo' } = {}) {
  return {
    title,
    description,
    uploadType: 'link',
    mediaType,
    isLocalFile: false,
    url: url ?? (mediaType === 'video' ? YOUTUBE_URLS[Math.floor(Math.random() * YOUTUBE_URLS.length)] : 'https://drive.google.com/file/d/automation/view'),
    platformType,
  };
}

/**
 * Item de upload + arquivo real. Devolve `{ item, files }` para espalhar no
 * payload e no multipart. `extra` acrescenta campos (ex.: `originalName`).
 */
function uploadMedia(kind, fieldKey, { title, description = 'Arquivo enviado pela automação', seed = 0, extra = {} } = {}) {
  const file = fixture(kind, { seed });
  const item = {
    title: title ?? `${MEDIA_TYPE_BY_KIND[kind]} ${file.filename}`,
    description,
    uploadType: 'upload',
    mediaType: MEDIA_TYPE_BY_KIND[kind],
    isLocalFile: true,
    fieldKey,
    originalName: file.filename,
    size: file.content.length,
    ...extra,
  };
  return { item, files: { [fieldKey]: file } };
}

/** Reenvia uma mídia já gravada (pelo id) sem arquivo novo, como o formulário faz. */
function toMediaInput(existing, overrides = {}) {
  const item = {
    id: existing.id,
    title: existing.title ?? undefined,
    description: existing.description ?? undefined,
    uploadType: existing.uploadType,
    mediaType: existing.mediaType,
    isLocalFile: Boolean(existing.isLocalFile),
    url: existing.url ?? undefined,
    platformType: existing.platformType ?? undefined,
    originalName: existing.originalName ?? undefined,
    size: typeof existing.size === 'number' ? existing.size : undefined,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(item).filter(([, v]) => v !== undefined && v !== null));
}

/** Junta vários `files` de `uploadMedia`. */
function mergeFiles(...parts) {
  return Object.assign({}, ...parts.map((p) => p?.files ?? p ?? {}));
}

module.exports = { linkMedia, uploadMedia, toMediaInput, mergeFiles, YOUTUBE_URLS };
