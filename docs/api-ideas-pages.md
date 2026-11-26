# Ideas pages: editor contract

`POST /ideas-pages` and `PATCH /ideas-pages/:id` require JWT authentication and
administrator role. They accept multipart `ideasMaterialsPageData` containing
`title`, optional `subtitle` and `public`, required `description` and the complete
`sections` array. Sections contain optional existing `id`, `title`, `description`,
optional `public` and `medias`. Removing an existing section/media from this
complete array removes it on successful save.

At least one section is required on both create and update, including draft
pages. Sections may have no materials. An empty section array is rejected before
the write service runs, preserving the existing page and its content.

Page/section titles must contain non-whitespace text and have at most 255
characters. Subtitle has the same maximum length; page description must contain
non-whitespace text. The JSON root must be an object. Link media require an absolute
HTTP(S) URL. Upload media require a matching multipart part for new files and
explicit replacements (`fieldKey`, or legacy `fileField`). Existing uploads without
a replacement keep server-side URL, filename and size. Their metadata cannot be
redirected by the client. Converting an upload to a link clears storage metadata.

Existing section IDs must belong to the edited page and media IDs to the edited
section. Duplicate and foreign IDs are rejected instead of silently making copies.
New sections and media omit their IDs. Omitted publication flags retain their
stored values. The route remains private to the teacher area.

Creation and update persist page, route, sections and media using one transaction
and its EntityManager. A failed write rolls back all database changes. New uploads
are tracked and unreferenced files are discarded on failure. Removed/replaced old
files are considered for deletion only after commit, with reference checking so
reused files remain available. No database schema change is required.

Validation uses the established 422 envelope with `VALIDATION_ERROR`,
`INVALID_INPUT`, `MEDIA_FIELD_MISSING` or `MEDIA_FILE_NOT_FOUND`. Existing
application exceptions preserve their codes; unexpected update failures retain
`PAGE_UPDATE_ERROR`.

DTO validation failures add `error.details.fieldErrors`, an array of
`{ field, message }` with paths such as `sections.1.medias.0.mediaType`.
`error.message` contains the first actionable message in Portuguese, with
one-based section/material positions. Validation details contain no submitted
values or DTO objects. Existing clients can continue displaying `error.message`.
