# Video pages (galeria de vídeos): editor contract

`POST /video-pages` and `PATCH /video-pages/:id` require JWT authentication and
administrator role. They accept multipart `videosPageData` containing `title`,
`description`, `public` and the complete `videos` array. Removing an existing
video from this array removes it (and its S3 file) on successful save.

Validation (before any write):

- Title and description must contain non-whitespace text; title has at most 255
  characters. A gallery may have no videos (draft).
- Existing video IDs must belong to the edited page; foreign or duplicate IDs are
  rejected (`INVALID_INPUT`) instead of silently creating copies.
- Link videos require an absolute HTTP(S) URL. New uploads require a matching
  multipart part (`fieldKey`); stored uploads are sent back with only id and URL.
- The JSON root must be an object.

Rejections use the 422 envelope and add `error.details.fieldErrors`, an array of
`{ field, message }` with paths such as `videos.1.url` or `videos.0.id`.
Messages are in Portuguese with one-based positions ("Vídeo 2 · Link: ...").
No submitted value is echoed back.

Persistence: create and update write the page, route, sections/videos and media
rows in a single database transaction (`EntityManager`); any failure rolls
everything back. Files uploaded during the attempt are discarded from S3 on
failure, and files that stop being referenced (removed or replaced media) are
deleted from S3 only **after** the commit. Delete removes media and the page in
one transaction and deletes the S3 files after the commit.
