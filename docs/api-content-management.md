# Content Management API Documentation

This documentation covers the CMS (Content Management System) features of the Clubinho NIB API. These modules allow administrators to manage dynamic content displayed on the app/website.

## 📋 Index

1. [Pages Management](#1-pages-management)
2. [Meditations](#2-meditations)
3. [Informatives](#3-informatives)
4. [Documents](#4-documents)
5. [Routes](#5-routes)

---

## 1. Pages Management

The application uses a dynamic page system where content is divided into specific page types.

### Generic Page Endpoints

Most page controllers follow a standard CRUD pattern.

**Common Base URLs:**

- `/week-material-pages`
- `/pages/video`
- `/pages/image` (includes sections)
- `/ideas-pages` (includes sections)
- `/pages/event`

### 1.1 Week Material Page

**Base URL**: `/week-material-pages`

- `GET /` - List all pages with their media, newest first
- `GET /current-week` - Page published as the current week material, or `null`
- `GET /:id` - Get a specific page with its media
- `POST /` - Create a page (admin, `multipart/form-data`)
- `PATCH /:id` - Update a page (admin, `multipart/form-data`)
- `DELETE /:id` - Remove a page, its media and its route (admin)
- `POST /current-week/:id` - Publish a page as the current week material (admin)

See [`api-week-materials.md`](api-week-materials.md) for the payload, the media
synchronization rules and the error catalog.

### 1.2 Video Page

**Base URL**: `/pages/video`

- `GET /` - List videos
- `POST /` - Register new video (YouTube/Vimeo links)

### 1.3 Image Page & Sections

**Base URL**: `/pages/image`

Manages galleries or visual sections.

- `GET /` - List image pages
- `GET /:id/sections` - List sections within an image page
- `POST /` - Create image page
- `POST /section` - Add section to a page

### 1.4 Ideas Page & Sections

**Base URL**: `/ideas-pages`

Páginas de ideias de atividades para os professores, organizadas em seções.

- `GET /` - Lista as páginas com suas seções e mídias. Uma página sem rota é
  omitida da listagem, com registro em log, para não derrubar a lista inteira
- `GET /:id` - Página com suas seções e mídias
- `POST /` - Cria a página (admin, `multipart/form-data`)
- `PATCH /:id` - Atualiza a página (admin, `multipart/form-data`)
- `DELETE /:id` - Remove a página, suas seções, mídias e a rota (admin, `204`)

**Corpo multipart**: campo `ideasMaterialsPageData` com o JSON da página, mais
uma parte por arquivo enviado, referenciada pelo `fieldKey` da mídia.

```jsonc
{
  "id": "uuid",            // só na atualização; o serviço usa o id da rota
  "title": "Ideias de Natal",
  "subtitle": "opcional",
  "description": "…",
  "public": false,          // opcional; preservado quando ausente
  "sections": [
    {
      "id": "uuid",         // ausente quando a seção é nova
      "title": "Abertura",
      "description": "…",
      "public": false,      // opcional; preservado quando ausente
      "medias": [
        {
          "id": "uuid",     // ausente quando a mídia é nova
          "title": "Vídeo",
          "description": "",
          "mediaType": "video",
          "uploadType": "link",
          "isLocalFile": false,
          "url": "https://…",
          "platformType": "youtube",
          "fieldKey": "video_0_0.mp4" // só quando um arquivo novo é enviado
        }
      ]
    }
  ]
}
```

**Regras de sincronização**

- As mídias pertencem à seção (`IdeasSection`), nunca à página.
- Seção que sai do payload é removida com suas mídias e os arquivos no S3.
- Mídia já gravada que volta sem `fieldKey` preserva o objeto no S3; com um
  arquivo novo, o anterior é apagado do S3 depois do upload.
- Um `id` de seção ou de mídia que não pertence ao alvo não sobrescreve o
  registro apontado: o item entra como novo, com aviso em log.
- O `path` da rota é recalculado a partir do título garantindo unicidade,
  ignorando a própria rota.
- A rota da página de ideias é sempre `public: false`: o acesso acontece pela
  Área do Professor.

### 1.4.1 Documentos — grafia do `targetType`

A criação gravava as mídias do documento com `targetType = 'Document'` enquanto
a edição gravava `'document'`. As leituras procuravam apenas por `'document'`,
então a mídia criada pelo fluxo de criação ficava invisível e o arquivo dela
permanecia no S3 mesmo depois de o documento ser removido.

Hoje toda escrita usa `DOCUMENT_MEDIA_TARGET_TYPE` (`'Document'`) e as leituras
aceitam as duas grafias (`DOCUMENT_MEDIA_TARGET_TYPES`), o que faz as linhas
antigas se normalizarem na próxima gravação. Para normalizar de uma vez:

```sql
UPDATE media_items SET targetType = 'Document' WHERE targetType = 'document';
```

Use `npm run s3:audit` depois, para listar os arquivos que ficaram órfãos
enquanto o problema existia.

### 1.5 Event Page

**Base URL**: `/pages/event`

Manages upcoming events.

- `GET /` - List events
- `POST /` - Create event
- `PUT /:id` - Update event details

---

## 2. Meditations

**Base URL**: `/meditations`

Manages daily or weekly meditations content.

### Endpoints

- `GET /` - List meditations (paginated)
- `GET /:id` - Get details
- `POST /` - Create meditation
- `PUT /:id` - Update meditation
- `DELETE /:id` - Delete

**DTO Fields (Create):**

- `title` (string)
- `content` (text/html)
- `date` (ISO date)
- `active` (boolean)

---

## 3. Informatives

**Base URL**: `/informatives`

News and announcements for the clubinho community.

### Endpoints

- `GET /` - List informatives
- `POST /` - Create informative
- `PUT /:id` - Update
- `DELETE /:id` - Delete

---

## 4. Documents

**Base URL**: `/documents`

Repository for official documents (PDFs, guidelines).

### Endpoints

- `GET /` - List available documents
- `POST /` - Upload/Register document
- `DELETE /:id` - Remove from registry

---

## 5. Routes

**Base URL**: `/routes`

Manages dynamic routing configuration for the frontend application.

### Endpoints

- `GET /` - List all configured routes
- `GET /:path` - Resolve specific route configuration

---

## 🔐 Permissions

- **Read Operations (GET)**: Generally public or authenticated users.
- **Write Operations (POST, PUT, DELETE)**: restricted to **Admin** and **Coordinator** roles.

---
⬅️ [Back to Documentation Hub](README.md)
