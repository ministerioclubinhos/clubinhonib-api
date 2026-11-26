# Image pages (galeria de fotos): editor contract

`POST /image-pages` and `PATCH /image-pages/:id` require JWT authentication and
administrator role. They accept multipart `imageData` containing `title`,
`description`, `public` and the complete `sections` array. Sections contain an
optional existing `id`, `caption`, `description`, `public` and `mediaItems`.
Removing an existing section/image from this complete array removes it (and its
S3 file) on successful save.

Validation (before any write):

- Gallery title and description must contain non-whitespace text; title has at
  most 255 characters. Section caption has at most 255 characters (may be empty).
- At least one section is required on create and update, including drafts.
- Existing section IDs must belong to the edited gallery and media IDs to the
  edited section; duplicate and foreign IDs are rejected (`INVALID_INPUT`)
  instead of silently creating copies.
- Link media require an absolute HTTP(S) URL. New upload media require a matching
  multipart part (`fieldKey`); already stored uploads are sent back with only
  their id and URL and keep the object in S3.
- The JSON root must be an object.

DTO validation failures use the 422 envelope with `VALIDATION_ERROR` and add
`error.details.fieldErrors`, an array of `{ field, message }` with paths such as
`sections.1.mediaItems.0.uploadType`. Messages are in Portuguese with one-based
positions ("Seção 2 · Imagem 1 · Tipo de envio: ..."). No submitted value is
echoed back.

Persistence: create and update write the page, route, sections/videos and media
rows in a single database transaction (`EntityManager`); any failure rolls
everything back. Files uploaded during the attempt are discarded from S3 on
failure, and files that stop being referenced (removed or replaced media) are
deleted from S3 only **after** the commit. Delete removes media and the page in
one transaction and deletes the S3 files after the commit.
