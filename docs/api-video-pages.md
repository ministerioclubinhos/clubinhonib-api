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

## Clubinho Play fields

Both `POST /video-pages` and `PATCH /video-pages/:id` accept an optional `play`
object and per-video Play attributes (`VideoItemDto extends MediaItemDto`):

```jsonc
{
  "play": { "scope": "selected" },          // none | all | selected
  "videos": [
    { "...": "...", "inPlay": true, "featured": true, "position": 1 },
    { "...": "...", "inPlay": false }
  ]
}
```

- `play` absent = the gallery's Play configuration is left untouched (old clients
  keep working). New galleries default to `none`.
- `inPlay` is only accepted with `scope = selected`; `featured` and `position`
  (0–9999) with `all` or `selected` (and, for `selected`, only on videos with
  `inPlay: true`). Violations return 422 with `fieldErrors` such as
  `videos.1.inPlay`. `selected` with no video marked is allowed (draft).
- Videos are linked to Play entries by payload position, in the same transaction
  as the page, route and media.
- Responses include `play: { scope }`, and per video `inPlay` (selected),
  `featured` and `position` when the scope is not `none`.

## Clubinho Play: extra write fields

- `play.categoryId` (uuid | null): category of the gallery. Absent keeps it, `null`
  removes it, an unknown id is a 422 at `play.categoryId`.
- Per video, with `play` other than `none` (and `inPlay: true` for `selected`):
  `thumbnailField` (multipart image part, up to 2 MB, `image/*`) and `durationSeconds`
  (0-86400, read in the admin's browser). Not re-sent = previous values kept.
  Replaced thumbnails are deleted from S3 only after the commit.
- Responses add `play.categoryId`, and per video `thumbnailUrl` and `durationSeconds`.

## Clubinho Play read/engagement API

All routes need `JwtAuthGuard` (any role) and the `clubinho_play` flag (403
`FEATURE_DISABLED` when off). Visibility: `play_scope = all`, or `selected` with an
entry; `mediaType = video` only; `public` does not interfere.

| Route | Purpose |
| --- | --- |
| `GET /play/home` | Rows: featured, continue watching, latest, most viewed (only with views), one per category (max 5) and per gallery (max 5). Empty rows are omitted. |
| `GET /play/videos` | Paginated (`limit` up to 50). Filters `search` (title, description, gallery, category), `galleryId`, `categoryId`, `favorites`, `inProgress`, `featured`; `sort` = `curated`, `recent`, `popular`, `title` or `continue`. |
| `GET /play/videos/:id` | 404 when not in Play. |
| `GET /play/videos/:id/related` | Same gallery first, then same category, then the rest. |
| `GET /play/categories` | Categories with the number of visible videos. |
| `POST /play/videos/:id/view` | One view per teacher per 30 minutes (`{ counted }`). |
| `PUT /play/videos/:id/progress` | `{ positionSeconds, durationSeconds? }`; 95% or more marks completed and resets the position. Personal data: only that user reads it. |
| `PUT/DELETE /play/videos/:id/favorite` | "Assistir depois" list. |

Admin only (`AdminRoleGuard`): `GET /play/admin/stats`, `POST /play/admin/categories`,
`PATCH/DELETE /play/admin/categories/:id` (deleting leaves galleries uncategorised).

`PlayVideoResponseDto`: `id, title, description, uploadType, platformType, url,
isLocalFile, originalName, size, galleryId, galleryTitle, featured, createdAt,
thumbnailUrl` (uploaded one, or YouTube's own), `durationSeconds, categoryId,
categoryName, viewCount, favorite, progress`.
Known limitation: `GET /video-pages/:id` and `GET /routes` remain public, so Play is
not an access-control mechanism.

## Clubinho Play: vídeos enviados por usuários (aprovação)

Flag própria `play_submissions` (além de `clubinho_play`): desligada, ninguém envia
(403 `FEATURE_DISABLED`); a fila de aprovação do admin continua funcionando.

Qualquer perfil logado (`teacher`, `coordinator`, `admin`) pode enviar. **Todo envio,
inclusive o do admin, fica `pending`** até um administrador decidir.

| Route | Who | Purpose |
| --- | --- | --- |
| `POST /play/submissions` | any logged user | Multipart: JSON in `submissionData` (`title`, `description?`, `uploadType` = `link` or `upload`, `url?` YouTube only, `durationSeconds?`) plus files `video` (video/*, up to 100 MB) and optional `thumbnail` (image, up to 2 MB). Max 10 pending per user. |
| `GET /play/submissions/mine` | author | Own submissions with status and rejection reason. |
| `DELETE /play/submissions/:id` | author | Withdraws a **pending** submission (files deleted from S3). Other people's ids answer 404. |
| `GET /play/admin/submissions?status&page` | admin | Queue (`pending` oldest first), with the submitter and `counts`. |
| `GET /play/admin/galleries` | admin | Galleries with Play on (`all` or `selected`), valid approval targets. |
| `POST /play/admin/submissions/:id/approve` | admin | `{ galleryId, featured? }`. In one transaction: creates the `media_items` video in the gallery, adds its `play_video_entries` row (thumbnail, duration) and marks the submission `approved`. Gallery with Play `none` is a 422. |
| `POST /play/admin/submissions/:id/reject` | admin | `{ reason? }` (up to 500). Marks `rejected` and deletes the uploaded files. |

A decided submission cannot be decided again (409). Uploaded files are deleted from S3
when the submission fails after upload, is withdrawn or is rejected.
