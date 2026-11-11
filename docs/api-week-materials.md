# Week Materials API (`/week-material-pages`)

Weekly material pages ("materiais semanais") are the content teachers open every
week: a titled page with a public route and four media groups (videos, documents,
images and audios).

Module: `src/modules/pages/week-material-page`.

## Module layout

```text
src/modules/pages/week-material-page/
├── week-material-page.module.ts
├── week-material-page.controller.ts     # HTTP transport only
├── constants.ts                         # route prefix, card image, entity type, payload field
├── types.ts                             # module-level types (files dict, media groups, sync plan)
├── utils.ts                             # pure helpers (payload parsing, media normalization/diff)
├── mappers.ts                           # entity + media -> response DTO
├── dto/
│   ├── week-material-media.dto.ts       # media arrays shared by create and update
│   ├── create-week-material.dto.ts
│   ├── update-week-material.dto.ts
│   └── week-material-response.dto.ts
├── entities/week-material-page.entity.ts
├── repositories/week-material-page.repository.ts
└── services/
    ├── create-week-material.service.ts
    ├── get-week-material.service.ts
    ├── update-week-material.service.ts  # also owns `setCurrentWeek`
    └── delete-week-material.service.ts
```

Services never touch TypeORM: every read and write goes through
`WeekMaterialsPageRepository`, whose methods accept an optional `EntityManager`
so they can join a transaction.

## Authentication and authorization

Every endpoint requires a valid JWT (`JwtAuthGuard` at controller level).
`POST`, `PATCH`, `DELETE` and `POST /current-week/:id` additionally require the
admin role (`AdminRoleGuard`). Route parameters are validated with
`ParseUUIDPipe`, so a malformed id returns `400` instead of reaching the service.

## Endpoints

| Method | Path | Role | Response |
| --- | --- | --- | --- |
| `GET` | `/week-material-pages` | authenticated | `WeekMaterialsPageResponseDTO[]`, newest first |
| `GET` | `/week-material-pages/current-week` | authenticated | `WeekMaterialsPageResponseDTO \| null` |
| `GET` | `/week-material-pages/:id` | authenticated | `WeekMaterialsPageResponseDTO` |
| `POST` | `/week-material-pages` | admin | `WeekMaterialsPageResponseDTO` |
| `PATCH` | `/week-material-pages/:id` | admin | `WeekMaterialsPageResponseDTO` |
| `DELETE` | `/week-material-pages/:id` | admin | empty body |
| `POST` | `/week-material-pages/current-week/:id` | admin | `WeekMaterialsPageResponseDTO` |

### Create and update payload

`POST` and `PATCH` are `multipart/form-data` requests:

- a `weekMaterialsPageData` field holding the JSON payload;
- one part per uploaded file, named exactly as the `fieldKey` of its media item.

```jsonc
{
  "pageTitle": "Semana 12",
  "pageSubtitle": "Tema da semana",
  "pageDescription": "Descrição do tema",
  "currentWeek": false,
  "videos": [
    {
      "title": "Vídeo de abertura",
      "description": "Introdução",
      "mediaType": "video",
      "uploadType": "link",
      "isLocalFile": false,
      "platformType": "youtube",
      "url": "https://youtube.com/embed/..."
    },
    {
      "id": "existing-media-uuid",
      "title": "Vídeo enviado",
      "description": "Arquivo local",
      "mediaType": "video",
      "uploadType": "upload",
      "isLocalFile": true,
      "fieldKey": "video_1"
    }
  ],
  "documents": [],
  "images": [],
  "audios": []
}
```

The payload is parsed and validated with the same rules as the global
`ValidationPipe` (`whitelist` + `forbidNonWhitelisted`), so unknown properties
are rejected with `VALIDATION_ERROR`.

`PATCH` accepts the legacy `id` property for backward compatibility with the
admin form, but the page updated is always the one identified by the route
parameter. `currentWeek` is accepted in both `POST` and `PATCH` bodies for the
same reason and is never applied: publishing goes only through
`POST /week-material-pages/current-week/:id`.

### Media synchronization on update

The media sent by the client is diffed against what is persisted:

- persisted items whose `id` is absent from the payload are deleted (row plus S3
  object when `isLocalFile`);
- items carrying an `id` are updated. A new `fieldKey` replaces the stored file
  (old object deleted, new one uploaded); without a `fieldKey` the stored URL,
  `originalName`, `size` and `isLocalFile` are preserved;
- items without an `id` are created, and an upload without a `fieldKey` fails with
  `MEDIA_FIELD_MISSING` before any write happens.

### Current week

`POST /week-material-pages/current-week/:id` publishes a page as the week
material inside a single transaction: the previously published page loses
`currentWeek` and `route.current`, and the target page becomes
`currentWeek = true`, `route.current = true`, `route.public = true`.

`GET /week-material-pages/current-week` returns the published page with its media
or `null` when no page is published.

## Errors

| Code | When |
| --- | --- |
| `INVALID_INPUT` | `weekMaterialsPageData` missing or not valid JSON |
| `VALIDATION_ERROR` | payload does not satisfy the DTO contract |
| `WEEK_MATERIAL_NOT_FOUND` | page id does not exist |
| `ROUTE_NOT_FOUND` | page exists without its route row |
| `MEDIA_FIELD_MISSING` | uploaded media without `fieldKey` |
| `MEDIA_FILE_NOT_FOUND` | `fieldKey` declared but the file was not sent |
| `PAGE_CREATE_ERROR` / `PAGE_UPDATE_ERROR` / `PAGE_DELETE_ERROR` | unexpected failure in the matching use case |

## Route path

The route `path` is `materiais_semanal_` plus the slug of the page title
(lower case, accents and punctuation removed, spaces as `_`). The path is
unique, so pages with the same base are told apart **only by a sequential
numeric suffix**: `materiais_semanal_semana_27`, then
`materiais_semanal_semana_27_1`, `materiais_semanal_semana_27_2`. There is no
random suffix.

- Availability is checked and the route is inserted in two steps. When a
  concurrent creation takes the path in between, the unique violation
  (`ER_DUP_ENTRY`) rolls back only that insert (savepoint) and the next free
  suffix is looked up again, up to 5 attempts. The lookup runs outside the page
  transaction, so each read sees routes already committed by others. When the
  attempts are exhausted the creation fails and the whole transaction rolls
  back.
- A title with no usable character (emoji or punctuation only) yields
  `materiais_semanal_pagina`; a very long title is cut so the path plus suffix
  fits the 255-character column. Common titles produce the same path as before
  and existing routes are never changed.
- Server-side callers may give the text the path is derived from
  (`WeekMaterialCreateOptions.routePathSource`). The Studio uses it for weekly
  materials: the page title is `Semana 27 — tema` and the path is
  `materiais_semanal_semana_27`. The option is not part of the HTTP payload;
  the admin form always derives the path from the title.

## Internal markers and duplicates

A Material Especial is a weekly material with its own title and description;
its description ends with `[tipo:especial]`, which the panel reads to show the
badge. Pages published by the Studio before 2026-11-10 also carry
`[origem:licao:<id>]`; the link in force is the `sourceLessonId` column. Both
markers are stripped from the announcement e-mail, and a page with the special
tag is announced as "Novo material especial" (same e-mail and feature flag).

`WeekMaterialsPageGetService.findPossibleDuplicates` lists existing pages that
are the same material (same week number for a weekly material, same normalized
title for a special one). It only informs the Studio publication preview;
creating a second page for the same week is allowed.

## Transactions and compensation

Page, route and media rows are written inside one transaction using the
transactional `EntityManager`, so a rollback leaves no page without route, no
route without page and no media row. S3 uploads happen during the transaction
and are tracked: when the creation fails before the commit, the uploaded
objects that no media row references are deleted. After the commit nothing is
compensated — a failure to schedule the announcement never fails the creation
nor deletes media. As a backstop for an ambiguous commit, the cleanup first
checks whether the page exists and, if it does, preserves its media.

## Tests

`npx jest src/modules/pages/week-material-page` covers utils, mappers, the
repository, the four services and the controller.
