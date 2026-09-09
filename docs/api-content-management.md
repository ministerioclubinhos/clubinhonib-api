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
- `/video-pages`
- `/image-pages` (includes sections)
- `/ideas-pages` (includes sections)
- `/events`

### 1.1 Week Material Page

**Base URL**: `/week-material-pages`

Todas as rotas exigem sessão.

- `GET /` - Lista paginada, em resumo
- `GET /current-week` - Página publicada como material da semana, ou `null`
- `GET /:id` - Página com todas as suas mídias
- `POST /` - Cria a página (admin, `multipart/form-data`)
- `PATCH /:id` - Atualiza a página (admin, `multipart/form-data`)
- `DELETE /:id` - Remove a página, suas mídias e a rota (admin)
- `POST /current-week/:id` - Publica a página como material da semana (admin)

A listagem devolve `Paginated<WeekMaterialSummaryDTO>`: `id`, `title`,
`subtitle`, `description`, `currentWeek`, `routePath`, `videoCount`,
`documentCount`, `imageCount`, `audioCount`, `createdAt` e `updatedAt`. As
mídias em si só vêm em `GET /:id`.

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (título,
subtítulo ou descrição), `currentWeek`, `sort` (`createdAt` | `title`) e
`order` (`ASC` | `DESC`). Tudo é resolvido no banco.

Uma página sem rota continua aparecendo na listagem, com `routePath: null`:
antes ela era omitida em silêncio e o registro inconsistente ficava invisível
para a administração.

See [`api-week-materials.md`](api-week-materials.md) for the payload, the media
synchronization rules and the error catalog.

### 1.2 Video Page

**Base URL**: `/video-pages`

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `GET /` | autenticado | Lista paginada, em resumo |
| `GET /:id` | público | Página com todos os seus vídeos |
| `POST /` | admin | Cria a página (multipart, `videosPageData`) |
| `PATCH /:id` | admin | Atualiza a página (multipart) |
| `DELETE /:id` | admin | Remove página, vídeos e rota (204) |

A listagem devolve o envelope `Paginated<VideoPageSummaryDto>`. O resumo tem
`id`, `title`, `description`, `public`, `routePath`, `videoCount`, `createdAt`
e `updatedAt` — os vídeos em si só vêm em `GET /:id`.

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (título ou
descrição), `public`, `sort` (`createdAt` | `title`) e `order` (`ASC` | `DESC`).
Tudo é resolvido no banco.

Uma página sem rota continua aparecendo na listagem, com `routePath: null`:
antes ela era omitida em silêncio e o registro inconsistente ficava invisível
para a administração.

### 1.3 Image Page & Sections

**Base URL**: `/image-pages`

Manages galleries or visual sections.

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `GET /` | autenticado | Lista paginada de galerias, em resumo |
| `GET /:id` | público | Galeria com suas seções e imagens |
| `GET /:id/sections` | público | Seções paginadas; as privadas só com sessão |
| `POST /` | admin | Cria a galeria (multipart, `imageData`) |
| `PATCH /:id` | admin | Atualiza a galeria (multipart) |
| `DELETE /:id` | admin | Remove galeria, seções, imagens e rota (204) |

A listagem devolve `Paginated<ImagePageSummaryDto>`: `id`, `title`,
`description`, `public`, `routePath`, `sectionCount`, `createdAt` e
`updatedAt`.

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (título ou
descrição), `public`, `sort` (`createdAt` | `title`) e `order`.

### 1.3.1 Fotos dos clubinhos (`/image-sections`)

Fotos enviadas por um clubinho. Elas **não** entram no feed direto: ficam numa
fila e a administração revisa e aprova.

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `POST /image-sections` | autenticado | Envia as fotos. Nascem sem página e fora do ar. |
| `GET /image-sections` | admin | A fila de revisão. Paginada, com busca e filtros. |
| `GET /image-sections/pending-count` | admin | `{ "pending": number }` para o aviso do painel. |
| `GET /image-sections/:id` | admin | Uma publicação. |
| `PATCH /image-sections/:id` | admin | Revisa e aprova: leva ao feed do clubinho. |
| `DELETE /image-sections/:id` | admin | Recusa: sai da fila e os arquivos saem do S3. |

`PATCH` e `DELETE` **não tinham guarda nenhuma**: qualquer pessoa, autenticada
ou não, editava ou apagava as fotos de qualquer clubinho. `GET` e `GET /:id`
eram públicos e sem paginação.

**Query da fila**

```typescript
{
  page?: number;          // padrão 1
  limit?: number;         // padrão 12, máximo 100
  searchString?: string;  // legenda ou descrição, filtrado no banco
  approved?: boolean;     // false = fila; true = já no feed
  hasMedia?: boolean;     // separa as publicações que ficaram sem foto
  sort?: 'createdAt' | 'caption';
  order?: 'ASC' | 'DESC';
}
```

Responde o envelope compartilhado (`data`, `total`, `page`, `limit`,
`pageCount`).

**Corpo multipart**: campo `sectionData` com o JSON, mais uma parte por arquivo,
endereçada pelo `fieldKey` da mídia correspondente.

```jsonc
{
  "caption": "Páscoa no Clubinho 12",
  "description": "…",
  "public": false,     // só na revisão; a criação não aceita este campo
  "mediaItems": [
    {
      "id": "uuid",    // ausente quando a mídia é nova
      "title": "Foto",
      "mediaType": "image",
      "uploadType": "upload",
      "isLocalFile": true,
      "originalName": "foto.jpg",
      "fieldKey": "file_0",
      "size": 2048
    }
  ]
}
```

`public` **não é aceito na criação**: quem envia não publica.

**ImageSectionResponseDto**

```typescript
{
  id: string;
  caption: string;
  description: string;
  public: boolean;
  pageId: string | null;   // null enquanto aguarda aprovação
  mediaItems: Array<{
    id: string;
    title: string | null;
    description: string | null;
    uploadType: string;
    mediaType: string;
    isLocalFile: boolean;
    url: string;
    platformType: string | null;
    originalName: string | null;
    size: number | null;
  }>;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

`pageId` distingue a publicação pendente da já aprovada. O front espelha este
contrato em `src/features/image-sections/types.ts`, e `mappers.spec.ts` trava o
conjunto exato de chaves deste lado.

### 1.4 Ideas Page & Sections

**Base URL**: `/ideas-pages`

Páginas de ideias de atividades para os professores, organizadas em seções.

- `GET /` - Lista paginada, em resumo (exige sessão)
- `GET /:id` - Página com suas seções e mídias
- `POST /` - Cria a página (admin, `multipart/form-data`)
- `PATCH /:id` - Atualiza a página (admin, `multipart/form-data`)
- `DELETE /:id` - Remove a página, suas seções, mídias e a rota (admin, `204`)

A listagem devolve `Paginated<IdeasPageSummaryDto>`: `id`, `title`,
`subtitle`, `description`, `public`, `routePath`, `sectionCount`, `createdAt`
e `updatedAt`. Uma página sem rota continua aparecendo, com `routePath: null`,
em vez de ser omitida em silêncio.

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (título,
subtítulo ou descrição), `public`, `sort` (`createdAt` | `title`) e `order`.

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

### 1.4.1 Ideias compartilhadas (`/ideas-sections`)

Uma ideia enviada por alguém da base. Ela **não** nasce numa página: entra numa
fila e a administração decide se e onde publicar.

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `POST /ideas-sections` | autenticado | Envia a ideia. Ela nasce sem página e fora do ar. |
| `GET /ideas-sections` | admin | A fila: ideias que ainda aguardam decisão. Paginada, com busca. |
| `GET /ideas-sections/pending-count` | admin | `{ "pending": number }` para o aviso do painel. |
| `GET /ideas-sections/:id` | admin | Uma ideia. |
| `PATCH /ideas-sections/:id` | admin | Edita sem mexer em onde está publicada. |
| `PATCH /ideas-sections/:id/attach/:pageId` | admin | **Aceita**: revisa e publica na página escolhida. |
| `DELETE /ideas-sections/:id` | admin | Recusa: sai da fila e os arquivos saem do S3. |

`GET /ideas-sections` e `GET /ideas-sections/:id` **eram públicos e sem
paginação**: qualquer pessoa listava todas as ideias, inclusive as que ainda
não tinham sido aprovadas.

**Query da fila**

```typescript
{
  page?: number;        // padrão 1
  limit?: number;       // padrão 12, máximo 100
  searchString?: string; // título ou descrição, filtrado no banco
  sort?: 'createdAt' | 'title';
  order?: 'ASC' | 'DESC';
}
```

Responde o envelope compartilhado (`data`, `total`, `page`, `limit`,
`pageCount`).

**Corpo multipart**: campo `sectionData` com o JSON, mais uma parte por arquivo,
endereçada pelo `fieldKey` da mídia correspondente.

```jsonc
{
  "title": "Brincadeira dos balões",
  "description": "…",
  "public": false,        // só na edição; a criação não aceita este campo
  "medias": [
    {
      "id": "uuid",       // ausente quando a mídia é nova
      "title": "Foto",
      "description": "",
      "mediaType": "image",   // image | video | document
      "uploadType": "upload", // upload | link
      "isLocalFile": true,
      "url": "https://…",     // nas mídias de link
      "platformType": "youtube",
      "originalName": "foto.jpg",
      "fieldKey": "image_upload", // liga esta mídia ao arquivo do multipart
      "size": 2048
    }
  ]
}
```

`public` **não é aceito na criação**: a ideia nasce fora do ar e publicar é ato
da administração. Aceitá-lo deixava quem enviava publicar a própria ideia.

`fileField` também saiu do contrato: é o nome interno que o processador de
mídias usa, derivado do `fieldKey`, e nunca deveria vir na requisição.

**IdeasSectionResponseDto**

```typescript
{
  id: string;
  title: string;
  description: string;
  public: boolean;
  pageId: string | null;   // null enquanto aguarda decisão
  medias: Array<{
    id: string;
    title: string | null;
    description: string | null;
    uploadType: string;
    mediaType: string;
    isLocalFile: boolean;
    url: string;
    platformType: string | null;
    originalName: string | null;
    size: number | null;
  }>;
  createdAt: string;       // ISO
  updatedAt: string;       // ISO
}
```

`pageId` é o que distingue a ideia pendente da já publicada. O front espelha
este contrato em `src/features/ideas-sections/types.ts`, e `mappers.spec.ts`
trava o conjunto exato de chaves deste lado.

**Correções de comportamento**

- Editar ou publicar uma ideia **inseria uma linha nova**: o `save` era chamado
  sem o `id`. Aceitar uma ideia criava uma cópia ligada à página e deixava a
  original parada na fila para sempre.
- A rota de publicar envolvia tudo em `try/catch` e devolvia **500** para
  qualquer falha — "página não encontrada" e erro de validação incluídos.
- A checagem de "upload declarado sem arquivo" existia e **nunca era chamada**:
  a mídia era gravada apontando para lugar nenhum.
- A guarda que impedia excluir uma ideia já publicada **nunca disparava**: a
  consulta não carregava a relação `page`.

### 1.4.2 Documentos — grafia do `targetType`

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

**Base URL**: `/events`

Agenda de eventos. O evento não tem página própria: o site lista tudo em
`/eventos`.

**Diagramas do fluxo**: [consulta e recorte por datas](diagrams/flow/events/events-query-flow.png),
[operações administrativas](diagrams/flow/events/events-management-flow.png) e
[sincronização dos encontros dos clubinhos](diagrams/flow/events/club-meeting-sync-flow.png).

- `GET /` - Lista os eventos, do mais antigo para o mais novo. Sem sessão, só
  os públicos
- `GET /upcoming` - Eventos de hoje em diante, mais os encontros semanais, que
  sempre valem. Sem sessão, só os públicos
- `GET /:id` - Um evento
- `POST /` - Cria (admin, `multipart/form-data`)
- `PATCH /:id` - Atualiza (admin, `multipart/form-data`)
- `DELETE /:id` - Remove o evento e a mídia dele (admin, `204`)

**Corpo multipart**: campo `eventData` com o JSON e campo `file` com a imagem.

```jsonc
{
  "title": "Festa da Família",
  "date": "2026-04-12",
  "location": "Salão da igreja",
  "description": "…",
  "audience": "all",          // all | teachers | coordinators
  "eventType": "custom",      // visit | meeting | custom
  "media": {
    "id": "uuid",             // ausente quando a imagem é nova
    "mediaType": "image",
    "uploadType": "upload",
    "isLocalFile": true,
    "url": "https://…"        // a URL guardada, quando não há arquivo novo
  }
}
```

**Encontro semanal do clubinho**

Cadastrar um clubinho — ou mudar dia, horário, endereço ou situação dele — cria
e mantém **um** evento no calendário:

- `isRecurring: true`, com `weekday` e `time` do clubinho. A linha guarda apenas
  a **definição** da recorrência, e `date` é o piso dela. As datas em que o dia
  de clubinho acontece **não** são gravadas;
- `public: false` — dia, horário e endereço **não** aparecem no site aberto. Só
  quem está autenticado recebe esses eventos em `GET /events` e
  `GET /events/upcoming`;
- `clubId` liga o evento ao clubinho e é **único**: a edição atualiza a mesma
  linha, e uma segunda linha para o mesmo clubinho é recusada pelo banco;
- `location` é o endereço em uma linha, ou "Endereço não informado";
- **nenhum e-mail é disparado** por esses eventos, em nenhuma operação. Criar,
  editar e excluir um encontro de clubinho são silenciosos: o encontro é
  operacional, nasce de cadastro administrativo e se repete toda semana. A
  regra vive em `AnnounceEventService`, o último ponto antes do envio, para
  valer em qualquer caminho até a agenda;
- `PATCH /events/:id` e `DELETE /events/:id` **recusam** um encontro de
  clubinho, com `CONTENT_8613` (`CLUB_MEETING_NOT_EDITABLE`). Alterar por ali
  seria desfeito na sincronização seguinte, e excluir deixaria o clubinho sem
  encontro. Para tirar um do calendário, desative ou exclua o clubinho.

**Em que dias o encontro acontece**

O campo `occurrences` da resposta traz as datas, calculadas a cada leitura:

```
occurrences = (weekday do clubinho) ∩ (período letivo ativo) − (exceções ativas)
```

O período letivo e as exceções vêm de `/club-control` (veja
[`MODULO-CONTROLE`](../src/modules/club-control/MODULO-CONTROLE.md)). Disso
decorrem as regras:

| Situação | Efeito |
| --- | --- |
| Nenhum período letivo ativo para o ano | **Nenhum dia de clubinho existe.** O encontro não é devolvido nas listagens |
| Período cadastrado depois | As datas passam a aparecer na consulta seguinte, sem regravar nada e sem job |
| Exceção criada, excluída ou reativada | A data sai ou volta na consulta seguinte, para todos os clubinhos daquele dia da semana |
| Exceção com `isRecurrent` | Vale para o mesmo dia e mês em qualquer ano |
| Exceção fora do período letivo | Sem efeito |
| Clubinho desativado ou excluído | **Todos** os dias saem do calendário: a linha é apagada. Clubinho inativo não tem dia nenhum |
| Clubinho reativado | Os dias são criados de novo, valendo a partir do dia da reativação — não há data antiga a preservar, a desativação apagou a linha |
| Dia da semana alterado | A série recomeça a partir de hoje — a data antiga descreveria encontros que nunca existiram |

Um evento **comum** não responde ao período letivo: ele foi marcado à mão para
um dia específico e traz esse único dia em `occurrences`.

Nada disso escreve na tabela `events`. É por isso que não há rotina varrendo
clubinhos quando um período ou uma exceção muda — e, por consequência, nenhuma
chance de duplicar encontro.

**Recorte de datas**

`GET /events` e `GET /events/upcoming` aceitam `from` e `to` (`YYYY-MM-DD`),
opcionais. Sem eles a resposta é a agenda inteira, como antes. Com eles, cada
evento traz só as ocorrências do intervalo — quem desenha um mês pede o mês, em
vez de carregar uma data por semana de cada período letivo cadastrado.

```
GET /events?from=2026-04-01&to=2026-04-30
```

Em `/events/upcoming` um `from` no passado é ignorado: "próximos" nunca olha
para trás.

**Fuso**

Todo dia de calendário é lido em `America/Sao_Paulo`, nunca no fuso do
processo — a API roda em contêiner, e contêiner roda em UTC. A definição está
em `shared/calendar-day`, a mesma que o agendador usa para as expressões de
cron.

**Regras**

- `date` é gravada como texto ISO. Toda comparação e formatação lê os
  componentes da string: `new Date('2026-04-12')` seria meia-noite UTC e viraria
  o dia anterior em qualquer fuso negativo.
- Uma edição sem arquivo novo reenvia a `url` guardada, e a API reaproveita o
  objeto que já está no S3.
- Criar, editar e excluir um evento **da agenda** disparam avisos por e-mail
  para toda a base — veja [`email.md`](email.md). Encontros de clubinho estão
  fora disso.
- A resposta usa `uploadType` na mídia. O contrato antigo chamava esse campo de
  `typeUpload`, diferente de todos os outros módulos; nenhum cliente o lia.

---

## 2. Meditations

**Base URL**: `/meditations`

Meditação semanal, de segunda a sexta. Todas as rotas exigem sessão.

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `GET /` | autenticado | Lista paginada, com os dias e a mídia |
| `GET /this-week` | autenticado | Meditação que cobre a data de hoje, ou `null` |
| `GET /:id` | autenticado | Detalhe da meditação |
| `POST /` | admin | Cria (multipart, `meditationData` + `file`) |
| `PATCH /:id` | admin | Atualiza (multipart) |
| `DELETE /:id` | admin | Remove meditação, mídia e rota (204) |

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (tema da
semana, ou tema/versículo de algum dia), `period` (`current` | `upcoming` |
`past`), `sort` (`startDate` | `topic` | `createdAt`) e `order`.

O recorte de período compara com a data de hoje resolvida no fuso da
aplicação, não no do servidor de banco.

**Campos de `meditationData`:**

- `topic` (string)
- `startDate` (`YYYY-MM-DD`, segunda-feira)
- `endDate` (`YYYY-MM-DD`, sexta-feira)
- `days` (5 itens: `day`, `topic`, `verse`)
- `media` (documento anexado à semana)

---

## 3. Informatives

**Base URL**: `/informatives`

News and announcements for the clubinho community.

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `GET /` | autenticado | Lista paginada |
| `GET /:id` | autenticado | Detalhe do informativo |
| `POST /` | admin | Cria o informativo e sua rota |
| `PATCH /:id` | admin | Atualiza informativo e rota |
| `DELETE /:id` | admin | Remove informativo e rota |

**Contrato (`InformativeResponseDto`):** `id`, `title`, `description`,
`public`, `routePath` (`null` quando não há rota), `createdAt`, `updatedAt`.

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (título ou
descrição), `public`, `sort` (`createdAt` | `title`) e `order`.

**Corpo de criação e edição:** `title`, `description`, `public` — e nada além
disso. O `id` vai apenas na URL: exigi-lo também no corpo fazia toda edição
responder 400, porque o formulário nunca o enviava.

---

## 4. Documents

**Base URL**: `/documents`

Repository for official documents (PDFs, guidelines).

| Rota | Quem acessa | O que faz |
| --- | --- | --- |
| `GET /` | autenticado | Lista paginada |
| `GET /:id` | público | Detalhe do documento, com a mídia |
| `POST /` | admin | Cria (multipart, `documentData` + `file`) |
| `PATCH /:id` | admin | Atualiza (multipart) |
| `DELETE /:id` | admin | Remove documento, mídia e rota (204) |

**Contrato (`DocumentResponseDto`):** `id`, `name`, `description` (`null`
quando vazia), `media` (`null` quando não há arquivo nem link), `createdAt`,
`updatedAt`.

**Query de `GET /`:** `page`, `limit` (máx. 100), `searchString` (nome ou
descrição), `hasMedia`, `sort` (`createdAt` | `name`) e `order`.

O filtro `hasMedia` considera as duas grafias históricas de `targetType`
(`Document` e `document`): procurar só por uma escondia a mídia de registros
antigos.

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
