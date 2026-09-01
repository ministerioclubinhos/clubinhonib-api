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
parameter.

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

## Transactions and compensation

Page and route writes run inside a transaction using the transactional
`EntityManager`. Media rows and S3 objects are written through the shared
`MediaItemProcessor`, which is not transaction-aware; on creation failure the
service compensates by deleting the media already persisted for the page. Making
media writes transactional requires changing the shared media module and is out
of scope for this module.

## Tests

`npx jest src/modules/pages/week-material-page` covers utils, mappers, the
repository, the four services and the controller.
