# Plano de Implementação Backend/Frontend — "Clubinho Play": plataforma de vídeos da Área do Professor

**Status:** plano (revisão 2, 2026-11-22). Nenhuma alteração de código, banco, infraestrutura, dependência ou ambiente está autorizada por este documento.

**Escopo:** `clubinhonib-api` (contrato, banco, regras) e `clubinhonib-app` (telas). Documento único dos dois lados.

**Independência:** este documento é **autossuficiente**. Não depende de nenhum outro plano, não exige que outro plano seja implementado antes ou depois e pode ser entregue, testado e revertido sozinho (ver §0.2).

---

## 0. Contrato de precisão — zero suposições

- **FATO:** verificado no código do repositório (arquivo e símbolo/linha).
- **RISCO:** consequência possível, sem prova de ocorrência.
- **PLANEJADO:** trabalho derivado de um FATO; não é comportamento atual.
- **DECISÃO PENDENTE:** o código e o pedido não determinam; só implementar com escolha explícita.
- **NÃO VERIFICADO:** hipótese que exige verificação (§10) antes de virar decisão.

### 0.1 Requisito confirmado pelo solicitante (texto do pedido)
1. Criar, no front, uma plataforma de vídeos tipo "mini YouTube" dentro da aplicação. **O nome não precisa ser "mini YouTube"** — será definido (P-001).
2. O admin cria a **página de vídeos** (galeria) e define que ela vai para essa plataforma.
3. Na **Área do Professor, na home, há um botão** que leva a essa plataforma.
4. Na plataforma "roda tudo dessa galeria de vídeos".
5. O **admin define os atributos** da plataforma (cabe a este plano propô-los).
6. O admin pode definir que **a galeria inteira** vai para a plataforma **ou só alguns vídeos**.
7. Isso pode ser feito **na criação** da galeria **ou na edição**.
8. O plano deve ser robusto, técnico e sem suposições.

### 0.2 Independência e fronteira de escopo
- **Entrada:** o modelo atual de galeria e vídeo (§1) e o contrato atual de `POST/PATCH /video-pages`. Nada além disso é pressuposto.
- **Funciona com qualquer vídeo que a galeria já aceita** (link ou upload), na forma em que ele é gravado hoje. Como o arquivo chegou ao S3 (fluxo atual ou outro) é irrelevante: o Play só lê a linha de `media_items`.
- **Dentro do escopo:** curadoria (escopo inteira/parcial, criação e edição), leitura própria do Play, botão na home, páginas do Play, flag.
- **Fora do escopo (não tratado, não pressuposto):** como o arquivo é enviado ao S3 (limite, retomada, validação); como a URL do arquivo é entregue ao leitor; qualquer mudança no armazenamento.
- **Coexistência:** se outra mudança também estender `POST/PATCH /video-pages`, os campos são disjuntos e se somam. O único ponto de contato é o DTO do item de vídeo (§4.5, P-014): se um DTO específico de vídeo já existir, apenas acrescentar `inPlay`; se não existir, criá-lo. É uma regra de merge, **não uma dependência**.
- **Reversão:** escopo `none` por galeria e flag (§7); migration aditiva com default que preserva o comportamento atual.

### 0.3 Retratações da revisão 1
| # | Afirmação da rev. 1 | Situação |
|---|---|---|
| R1 | "Os `public: false` aparecem só para logados" (F2) | **Retratada.** Não está comprovado. Fato: `GET /routes` e `GET /video-pages/:id` **não têm guard** (§1, F-API-3/4). |
| R2 | Criar uma flag nova `clubinho_play` sem considerar a existente | **Retratada.** Já existe a flag `training_videos` (front e back) que controla `/area-do-professor/videos` e o item do menu (§1, F-FLG-1). Decisão P-002. |
| R3 | `position` e `featured` apresentados como atributos "novos fáceis" | **Retratada.** Hoje as mídias são lidas **sem `ORDER BY`** (F-DB-3): não há ordem definida; qualquer ordenação é desenho novo. |
| R4 | Campo `inPlay` "por item" no payload sem ver a validação | **Retratada.** A validação usa `whitelist: true` e `forbidNonWhitelisted: true` (F-API-6): campo não declarado no DTO é **rejeitado (422)**. O contrato precisa de DTO próprio (§5.2). |
| R5 | Endpoint `GET /play/home` com "continuar assistindo", visualizações, favoritos já descritos como fase 1/2 | **Retratada.** Nada disso existe nem foi pedido; vira **proposta opcional** com decisão (P-008). O pedido exige apenas: botão na home, galeria no Play, escolha inteira/parcial, criação/edição. |
| R6 | Guard de papel para o Play | **Retratada.** Só existem `AdminRoleGuard` e `AdminOrLeaderRoleGuard` (F-API-5); papéis do sistema: `admin`, `teacher`, `coordinator`. |

---

## 1. Evidências do repositório (FATOS)

### 1.1 Modelo de vídeo e galeria
| ID | Fato | Evidência |
|---|---|---|
| F-DB-1 | `VideosPage` (`videos_pages`): `name`, `public` (boolean), `description` (text), `route` (`OneToOne`, `cascade`, `eager`, `onDelete: CASCADE`) + `id/createdAt/updatedAt` de `BaseEntity`. | `modules/pages/video-page/entities/video-page.entity.ts`; `shared/share-entity/base.entity.ts` |
| F-DB-2 | Vídeo = linha de `media_items` com `targetId` (uuid da galeria) e `targetType` (`'VideosPage'`), colunas: `title`, `description`, `mediaType`, `uploadType` (link/upload), `platformType` (youtube/googledrive/onedrive/dropbox/ANY), `url`, `isLocalFile`, `originalName`, `size`. **Sem FK** de `targetId` (alvo polimórfico). **Não há** colunas de duração, miniatura, ordem, categoria, destaque. | `shared/media/media-item/media-item.entity.ts`; `media-target-type.enum.ts` |
| F-DB-3 | Leitura das mídias por alvo: `mediaRepo.find({ where: { targetId, targetType } })` — **sem `order`**. | `shared/media/media-item-repository.ts:22,74` |
| F-DB-4 | `RouteEntity` (`routes`): `title, subtitle, public (default true), current, image, idToFetch, path (unique), entityType, description, entityId, type`. A galeria grava `public` **tanto** em `videos_pages.public` quanto em `routes.public`. | `modules/routes/route-page.entity.ts`; `create-video-page.service.ts` (`persistPageWithRoute`); `update-video-page.service.ts` (`upsertRoute`) |
| F-DB-5 | Criação e edição acontecem **numa transação** (`runInTransaction`) que cobre página, rota e mídias; arquivos removidos só são apagados do S3 após o commit. IDs de vídeo são estáveis na edição (`media.id = previous.id`; `planVideoSync` separa `toRemove/toUpdate/toCreate`). | `create-video-page.service.ts`; `update-video-page.service.ts` (`syncVideos`, `updateExistingVideo`); `video-page/utils.ts` (`planVideoSync`) |

### 1.2 API
| ID | Fato | Evidência |
|---|---|---|
| F-API-1 | Escrita: `POST /video-pages`, `PATCH /video-pages/:id`, `DELETE /video-pages/:id` com `JwtAuthGuard` + `AdminRoleGuard`. | `video-page.controller.ts` |
| F-API-2 | `GET /video-pages` (listagem do painel, paginada, com `VideoPageSummaryDto`) exige apenas `JwtAuthGuard` (qualquer perfil logado). | `video-page.controller.ts:80-88` |
| F-API-3 | `GET /video-pages/:id` **sem guard** (público). Devolve página + vídeos. | `video-page.controller.ts:90-97` |
| F-API-4 | `GET /routes` e `GET /routes/:id` **sem guard**; a lista inclui rotas com `public:false`. | `modules/routes/*controller.ts` (apenas `@Controller('routes')` e `@Get`) |
| F-API-5 | Guards de papel existentes: `AdminRoleGuard`, `AdminOrLeaderRoleGuard`. Papéis: `admin`, `teacher`, `coordinator`. | `core/auth/guards/role-guard.ts:16,53`; `core/auth/auth.types.ts:3-7` |
| F-API-6 | Validação do payload multipart: `parseAndValidatePayload` usa `plainToInstance` + `validate(..., { whitelist: true, forbidNonWhitelisted: true })`; erro por campo em `error.details.fieldErrors` (`field`, `message`). O DTO compartilhado de mídia é `MediaItemDto` (usado também por outros módulos). | `shared/media/payload-validation.ts`; `shared/share-dto/media-item-dto.ts`; `video-page/dto/create-videos-page.dto.ts` |
| F-API-7 | Resposta pública de vídeo (`VideoItemResponseDto`) devolve `url` crua (inclui URL do S3 para uploads). | `video-page/mappers.ts` (`toVideoResponse`) |
| F-API-8 | Envelope paginado existente: `Paginated<T>` = `{ data, total, page, limit, pageCount }`. | `shared/dto/paginated.dto.ts` |
| F-API-9 | Existe consulta de flag no servidor: `FeatureFlagsService.isSwitchedOn(key, whenMissing)` (**sem perfil**: usa o escopo `__switch__` do cache); flags são semeadas em `DEFAULT_FEATURE_FLAGS` (`key`, `name`, `description`, `enabled`, `targetRoles`). | `core/feature-flags/services/get-feature-flags.service.ts:172`; `core/feature-flags/constants.ts:6-10,52` |

### 1.3 Front — Área do Professor
| ID | Fato | Evidência |
|---|---|---|
| F-FRT-1 | Home da Área do Professor: `TeacherArea.tsx` monta `FofinhoButton` com `references` condicionados por flag (`childrenArea`, `materials`, `photos`, `ideas`, `events`, `rate`, `help`). O mapa `buttonMap` (chave → `{to,label,subtitle,icon,color,accentHex}`) está em `FofinhoButton.tsx` (~linha 262-289; `childrenArea` é a última entrada). **Não há botão de vídeos.** | `pages/TeacherArea/TeacherArea.tsx`; `components/Buttons/FofinhoButton.tsx` |
| F-FRT-2 | A home também tem a seção `TrainingVideosSection`, que lista rotas de vídeo (`selectVideoRoutes` = `routes.filter(entityType === VideosPage)`, **inclui** `public:false`), com busca por título/subtítulo, e navega para `getRoutePagePath(route)` (= `/area-do-professor/videos/:id`). | `Sections/TrainingVideosSection.tsx`; `store/selectors/routeSelectors.ts:6-9`; `pages/TeacherArea/pagePaths.ts` |
| F-FRT-3 | Rotas: `/area-do-professor/videos` → `TeacherVideosPage` (que é o `TrainingVideosSection`, `lazyPages.ts:48-51`), protegida por `FeatureRoute flag={FEATURE.TRAINING_VIDEOS}`; `/area-do-professor/videos/:id` pelo `TEACHER_NESTED_PAGES.map(...)` → `TeacherNestedPage` → `PageRenderer`. | `App.tsx:330-331,474-478`; `TeacherNestedPage.tsx` |
| F-FRT-4 | Menu lateral da Área do Professor tem o item "Galeria de Vídeos" (`/area-do-professor/videos`, com contador `counts.videos`) condicionado a `FEATURE.TRAINING_VIDEOS`. | `components/Layout/TeacherAreaSidebar.tsx:149-158` |
| F-FRT-5 | Site público: `/fotos-e-videos` e `/fotos-e-videos/videos/:id` (`PublicMediaDetailPage`) filtram rotas por `route.public`. | `App.tsx:313-315`; `features/public-media/utils.ts` (`selectPublicMediaItems`) |
| F-FRT-6 | Página do vídeo (`PageVideoView`/`VideoCard`/`VideoPlayer`): `VideoPlayer` usa `<video><source>` para upload e iframes por plataforma (YouTube via `getYouTubeId`; Drive pelo regex `/d/([\w-]+)`; OneDrive/Dropbox/ANY usam `video.url` direto). `VideoCard` renderiza `<video src muted>` para uploads (sem miniatura). | `pages/PageView/VideoViewPage/*` |

### 1.4 Front — formulário da galeria
| ID | Fato | Evidência |
|---|---|---|
| F-FRM-1 | `VideoPageForm` (criação e edição, mesma tela) usa `useVideoPageForm`; estado: `values` (`title`, `description`, `public`), `videos` (`VideoDraft[]`), `errors`, `videoApiErrors`, `isDirty`. | `features/video-pages/VideoPageForm.tsx`; `hooks.ts:210-250` |
| F-FRM-2 | `VideoEditor` mantém um rascunho de vídeo (`draft`) com `title/description/uploadType/platformType/url/file`, edição por índice, busca quando `videos.length >= VIDEO_SEARCH_THRESHOLD`. | `features/video-pages/components/VideoEditor.tsx` |
| F-FRM-3 | O payload vem de `buildVideoPagePayload`/`toVideoRequest` (`utils.ts`), com o JSON em `videosPageData` e arquivos em `video-file-<índice>`. | `features/video-pages/utils.ts`; `constants.ts` |

### 1.5 Feature flags
| ID | Fato | Evidência |
|---|---|---|
| F-FLG-1 | **Já existe** `training_videos` ("Vídeos de Treinamento"): back `DEFAULT_FEATURE_FLAGS` (`enabled: true`, `targetRoles: ['admin','coordinator','teacher']`); front `FEATURE.TRAINING_VIDEOS`, tipo/default em `constants/featureFlags.ts:55,112`. | `core/feature-flags/constants.ts:249-255`; `features/feature-flags/features.ts:65` |
| F-FLG-2 | `useVisibleRoutes` filtra as rotas dinâmicas pela flag do tipo (`ROUTE_TYPE_FLAG[VideosPage] = FEATURE.PUBLIC_VIDEOS`). | `features/feature-flags/useVisibleRoutes.ts:20-30` |
| F-FLG-3 | O front tem `FEATURE_PROFILE_RULES` (`Public` ou `Roles`) por flag. Se toda flag **precisa** de entrada nesse mapa: **NÃO VERIFICADO** (N6). | `features/feature-flags/constants.ts:~120-` |
| F-FLG-4 | Regras do projeto: flag de e-mail separada (não se aplica); migration só via `migration:generate`; diagrama PlantUML + `.png`; testes limitados em CPU/RAM; e2e com API real, sem mock, logando por papel; UI mobile first (`CLAUDE.md`, memórias do projeto). | `clubinhonib-api/CLAUDE.md` |

---

## 2. Conclusões do diagnóstico (derivadas dos FATOS)

1. A galeria (`VideosPage`) e seus vídeos já existem e sabem ser criados/editados numa transação (F-DB-5). **O Play é uma camada de curadoria sobre isso**; não precisa duplicar vídeos.
2. **Não existe hoje** nenhum conceito de "este vídeo/galeria vai para o Play" (F-DB-2). É **a** lacuna a modelar (§4.2).
3. A home do professor já tem pontos de extensão concretos: `buttonMap`/`references` (F-FRT-1), rotas `TEACHER_NESTED_PAGES` (F-FRT-3) e menu lateral (F-FRT-4).
4. Já existe uma superfície de vídeos para professores (`TrainingVideosSection` + `training_videos`). O Play **a substitui, complementa ou convive** — decisão P-002.
5. O contrato de escrita é estrito (`forbidNonWhitelisted`, F-API-6): qualquer atributo novo exige DTO.
6. As mídias não têm ordem definida (F-DB-3) e as leituras públicas devolvem URL crua (F-API-7).
7. Visibilidade hoje depende de endpoints **sem guard** (F-API-3/4). Um vídeo "só do Play" **não** fica restrito por construção (§6).

---

## 3. Decisões pendentes

A coluna "Sugestão" é apenas recomendação técnica; **não é decisão**.

| ID | Decisão | Opções | Sugestão / justificativa |
|---|---|---|---|
| **P-001** | Nome da plataforma (rótulo, rota, chave da flag, nomes técnicos) | (A) Clubinho Play · (B) Sala de Vídeos · (C) Videoteca NIB · (D) Cantinho do Vídeo · (E) outro | Sem evidência de preferência. Pedido: "não precisa ter esse nome… vamos criar outro". **Definir.** Neste documento "Play" é só apelido técnico. |
| **P-002** | Relação com `TrainingVideosSection`, `/area-do-professor/videos`, item "Galeria de Vídeos" do menu e a flag `training_videos` (F-FRT-2/3/4, F-FLG-1) | **(A)** Substituir: o Play assume a rota/menu e reaproveita `training_videos` (uma flag só, perfis já configurados). **(B)** Conviver: o Play ganha rota, botão e **flag própria**; a lista antiga continua. **(C)** Substituir mas com flag nova. | Decidir. (A) evita duas superfícies para o mesmo conteúdo e não cria flag; (B) é a opção de menor risco de regressão; (C) exige migrar o estado da flag antiga. |
| **P-003** | O Play depende de `public`? | **(A)** Independente: galeria pode estar só no Play, só no site ou em ambos. **(B)** Só galerias com `public = true` entram no Play. | O pedido não diz. (A) permite conteúdo exclusivo de professor mas **exige** fechar o vazamento por endpoints sem guard (§6, P-009). |
| **P-004** | Modelagem da seleção "galeria inteira / só alguns" | **(A)** Coluna em `videos_pages` (`play_scope`) + tabela de entradas por vídeo (§4.2). **(B)** Colunas em `media_items` (`in_play`…). **(C)** Só por vídeo (sem escopo de galeria). | (A) não contamina `media_items`, tabela compartilhada por documentos, imagens, meditações etc. (F-DB-2). (C) não atende "galeria inteira inclusive vídeos futuros". |
| **P-005** | Vídeo adicionado **depois** a uma galeria com escopo "inteira" | **(A)** Entra automaticamente. **(B)** Só entra se marcado. | Decorre do significado de "galeria inteira" (A); confirmar. |
| **P-006** | Categorias dos vídeos | **(A)** Nenhuma na v1. **(B)** Tabela editável pelo admin, atribuída à **galeria**. **(C)** Lista fixa em código (enum). **(D)** Tags livres. | O pedido fala em "atributos" sem listá-los. Decidir o conjunto mínimo (§4.3). |
| **P-007** | Atributos de vídeo no Play (duração, miniatura, destaque, ordem, publicação) | Ver §4.3 (cada um é opcional e independente) | O pedido deixa a definição para este plano. **Escolher o conjunto**; só `inPlay` e o escopo são indispensáveis ao pedido. |
| **P-008** | Engajamento (progresso por usuário, visualizações, favoritos) | **(A)** Nenhum. **(B)** Progresso. **(C)** Visualizações agregadas. **(D)** Favoritos. | **Não pedido.** Só entra se aprovado; envolve dado pessoal e privacidade (§6). |
| **P-009** | Vazamento por `GET /video-pages/:id` e `GET /routes` (F-API-3/4) para galerias fora do Play ou `public=false` | **(A)** Exigir login em `GET /video-pages/:id` quando `public=false`. **(B)** Manter como está e aceitar a exposição. **(C)** O Play usa só endpoints novos e o vídeo "só Play" continua acessível por quem souber o id. | **Decidir.** É mudança de contrato; antes verificar consumidores (N3). |
| **P-010** | Flag própria do Play (se P-002 = B ou C) | Nome/chave, `targetRoles`, estado inicial (`enabled`) | **Definir.** `isSwitchedOn` do servidor não tem perfil (F-API-9). |
| **P-011** | Ordem de exibição dos vídeos dentro da galeria e do Play | **(A)** Por `createdAt` do vídeo. **(B)** Campo `position` administrável. **(C)** Alfabética | Hoje **não há ordem** (F-DB-3). Escolher ao menos um critério determinístico. |
| **P-012** | Tipo de mídia aceito no Play | Só `mediaType = video` (já é o que a galeria guarda) / incluir áudio | Galeria de vídeos só cria `mediaType = video` (F-FRM-3). Confirmar que nada além disso entra. |
| **P-013** | Perfis que veem o Play | Todos (`admin`,`coordinator`,`teacher`) / subconjunto | Hoje `training_videos` usa os 3 (F-FLG-1). |

---

## 4. Desenho técnico (condicionado às decisões)

> Regras do repositório (`CLAUDE.md`): controller só HTTP; serviços separados por operação (create/get/update/delete); persistência só em repository; **um serviço de módulo A nunca chama repository de módulo B — chama o serviço do módulo B**; DTOs de entrada/saída explícitos, sem expor entidade crua; `types`/`constants`/`utils`/enums em arquivos próprios; **nunca `any`**; enums para conjuntos finitos.

### 4.1 O que o admin define (UI, criação e edição — mesma tela `VideoPageForm`, F-FRM-1)
- **Modo no Play** (enum `PlayScope`): `none` (padrão, comportamento atual) · `all` (galeria inteira) · `selected` (só alguns). *(requisito 0.1-6)*
- **Em `selected`:** caixa **"No Play"** em **cada vídeo** da lista do `VideoEditor` (F-FRM-2). Vale para vídeos já salvos (têm `id`) e para vídeos novos ainda sem `id`.
- Opcional, por P-006/P-007: categoria, destaque, ordem.
- **Mesma regra e mesmos campos na criação e na edição** (requisito 0.1-7): o mesmo payload e o mesmo serviço de domínio.

### 4.2 Modelo de dados (P-004 = A) — **exige autorização**; seguir `AI_DATABASE_CHANGE_REQUIREMENTS.md`
```text
videos_pages
  + play_scope  ENUM('none','all','selected') NOT NULL DEFAULT 'none'
  + play_category_id  UUID NULL  FK → play_categories(id) ON DELETE SET NULL   (só se P-006 = B)

play_video_entries            (só quando play_scope = 'selected'; ver P-005)
  id            UUID PK
  videos_page_id UUID NOT NULL  FK → videos_pages(id) ON DELETE CASCADE
  media_item_id  UUID NOT NULL  FK → media_items(id)  ON DELETE CASCADE   UNIQUE
  featured       BOOLEAN NOT NULL DEFAULT false      (só se P-007 incluir destaque)
  position       INT NULL                              (só se P-011 = B)
  createdAt / updatedAt  (BaseEntity)

play_categories               (só se P-006 = B)
  id UUID PK · name VARCHAR(255) NOT NULL · slug VARCHAR(255) UNIQUE · position INT
```
- `media_items` tem PK `id` (uuid, `BaseEntity`), logo a FK é possível, embora `targetId` seja polimórfico sem FK (F-DB-2).
- **Zero mudança de comportamento por padrão:** toda galeria existente nasce `play_scope = 'none'`. **Sem backfill**.
- **Regras de execução (CLAUDE.md):** migration **somente** via `migration:generate` oficial do TypeORM — nunca `migration:create`, nunca manual, nunca `synchronize` para publicar schema. Lembrete do projeto: `DB_SYNCHRONIZE` local atrapalha o `migration:generate` (dropar a coluna, gerar e fazer deploy encadeado). Diagramas PlantUML em `docs/diagrams/database/` e fluxo em `docs/diagrams/flow/<nome>/`, com `.png` gerado na hora (`npm run diagrams:generate`).
- Entidades novas precisam constar em `src/database/entities.ts` (arquivo que já aparece na busca por "video" no repositório). **NÃO VERIFICADO** se esse arquivo é a lista usada pelo `DataSource` do `migration:generate` — confirmar antes (N9).

### 4.3 Atributos propostos para o Play (cada um depende de P-006/P-007/P-011; nada é obrigatório além do escopo)
| Atributo | Nível | Fonte | Observação técnica |
|---|---|---|---|
| `playScope` | galeria | admin | **Indispensável** (requisito 0.1-6) |
| `inPlay` | vídeo (quando `selected`) | admin | **Indispensável** (requisito 0.1-6) |
| `featured` | vídeo | admin | Opcional |
| `position` | vídeo | admin | Opcional; **resolve R3** (F-DB-3). Sem ele, definir ordem determinística por `createdAt` |
| categoria | galeria | admin | Opcional |
| `durationSeconds` | vídeo | **navegador do admin** (`loadedmetadata`) — **NÃO VERIFICADO** em todos os formatos; links externos não têm | Opcional; exigiria coluna em `media_items` ou tabela de entradas (extensão de P-004) |
| miniatura | vídeo | YouTube: `https://img.youtube.com/vi/<id>/hqdefault.jpg` (já usado em `utils/video.ts`); upload: extrair quadro no navegador e enviar imagem | Opcional; **sem miniatura**, o `VideoCard` atual carrega `<video>` inteiro (F-FRT-6) |
| `publishedAt` no Play | vídeo | automático (`createdAt` da entrada) | Opcional |

### 4.4 API — leitura (PLANEJADA)
Módulo novo `play` (ou nome de P-001). **Sempre** `JwtAuthGuard`; verificação de flag no servidor (P-010/F-API-9). Não existe guard "qualquer papel" — `JwtAuthGuard` basta, pois os únicos papéis são `admin/teacher/coordinator` (F-API-5); restrição por perfil usa a flag.

| Endpoint | Resposta | Regras |
|---|---|---|
| `GET /play/videos` | `Paginated<PlayVideoResponseDto>` (F-API-8) | filtros `search` (título/descrição, tamanho máx. a definir), `galleryId`; `categoryId`/`featured` se P-006/P-007; ordenação conforme P-011; `page`/`limit` com máximos em constantes |
| `GET /play/videos/:id` | `PlayVideoResponseDto` | **404** se o vídeo não está no Play, **mesmo que exista na galeria** |
| `GET /play/categories` | lista com contagem | só se P-006 = B |

`PlayVideoResponseDto` (campos mínimos, todos existentes em F-DB-2): `id`, `title`, `description`, `uploadType`, `platformType`, `url`, `isLocalFile`, `originalName`, `size`, `galleryId`, `galleryTitle`, `createdAt`. **Sem** `targetId`/`targetType`. A `url` segue **exatamente** a regra atual (F-API-7): o Play devolve o mesmo valor que a galeria já devolve; **não piora nem altera** essa exposição, e alterar a forma de entrega da URL está **fora do escopo** deste plano.

**Regra de visibilidade (única fonte de verdade, em um serviço de domínio):** o vídeo entra no Play se, e somente se, `videos_pages.play_scope = 'all'` **ou** (`play_scope = 'selected'` **e** existe linha em `play_video_entries` para ele). `public`/`routes.public` não interferem se P-003 = A.

### 4.5 API — escrita (PLANEJADA)
Sem endpoint novo de vídeo: o Play viaja **no mesmo** `POST /video-pages` e `PATCH /video-pages/:id` (F-API-1), na **mesma transação** (F-DB-5). Como a validação rejeita campo não declarado (F-API-6/R4):
- `CreateVideosPageDto`/`UpdateVideosPageDto` ganham `play?: PlayConfigDto` (`scope: PlayScope`, e os campos de P-006/P-007 que forem aprovados);
- o item de vídeo ganha `inPlay?`, e demais campos aprovados, num **DTO específico de vídeo** (`VideoItemDto extends MediaItemDto`), **sem** alterar `MediaItemDto` compartilhado (F-API-6) — **DECISÃO PENDENTE P-014** (alternativa: campo no DTO compartilhado, que afetaria outros módulos).
- `PlayConfigDto` ausente = nenhuma mudança no Play da galeria (compatível com clientes antigos).

Exemplo de contrato (campos opcionais conforme as decisões acima):
```jsonc
{
  "title": "…", "description": "…", "public": true,
  "play": { "scope": "selected" },
  "videos": [
    { "id": "<uuid>", "...campos atuais...", "inPlay": true },
    {             "...campos atuais...", "inPlay": false }
  ]
}
```
Validações (PLANEJADAS; envelope 422 com `fieldErrors`, mensagens em português com posição, como `docs/api-video-pages.md`):
- `scope` ∈ enum; `inPlay` só é aceito se `scope = 'selected'` (caso contrário 422 em `videos.N.inPlay`);
- `scope = 'selected'` com **zero** marcados: **DECISÃO PENDENTE P-015** (permitir como rascunho, ou 422);
- ids de vídeo continuam validados por `assertOwnedUniqueIds` (F-DB-5);
- para vídeos **novos** (sem `id`), a entrada em `play_video_entries` só pode ser gravada **depois** de `processMediaItemsPolymorphic` devolver as mídias criadas; o vínculo entre o item do payload e a mídia criada é pela **posição** (o método devolve `results` na mesma ordem de `items`, F-DB-5 — **confirmar em teste**, N4).
- remover o vídeo da galeria remove sua entrada (FK `ON DELETE CASCADE`).

### 4.6 Front (PLANEJADO)
```text
src/features/<play>/                       (nome conforme P-001)
  constants.ts  types.ts  utils.ts  api.ts  hooks.ts  index.ts
  PlayHomePage.tsx          # lista + busca (+ categorias/destaques se aprovados)
  PlayVideoPage.tsx         # player de um vídeo
  components/PlayVideoCard.tsx, PlayPlayer.tsx, PlayEmptyState.tsx
src/features/video-pages/                  (alterações)
  components/PlaySettings.tsx   # seção "modo no Play" no VideoPageForm
  components/VideoEditor.tsx    # caixa "No Play" por vídeo
  types.ts, utils.ts, hooks.ts  # play/inPlay em VideoPageFormValues/VideoDraft/payload (toVideoRequest)
src/pages/TeacherArea/
  components/Buttons/FofinhoButton.tsx   # nova entrada no buttonMap
  TeacherArea.tsx                        # nova referência em `references`, atrás da flag
  pagePaths.ts, App.tsx                  # rotas do Play (dentro de TeacherAreaLayout)
  components/Layout/TeacherAreaSidebar.tsx # item do menu (conforme P-002)
src/features/feature-flags/features.ts + constants/featureFlags.ts   # se flag nova (P-002/P-010)
```
- **Botão na home:** nova chave no `buttonMap` e em `references` (F-FRT-1), `to` = rota do Play, ícone de play, atrás da flag. Mobile first: estilos base `xs`, escala para `md+`.
- **Rotas** dentro de `TeacherAreaLayout`, junto das atuais (F-FRT-3). Se P-002 = A, `/area-do-professor/videos` passa a renderizar o Play e `TrainingVideosSection` deixa de ser usada ou vira prévia.
- **Player único:** reaproveitar o tratamento de erro/`preload="metadata"` do `ClubinhoVideoPlayer` e a lógica de embed por plataforma do `VideoPlayer`. O parser de YouTube do app (`utils/video.ts`) e o da API (`shared/media/youtube-url.ts`) **divergem** (regex solta vs. allowlist de host + ID de 11 caracteres): **unificar a regra** antes de reutilizar. `sandbox` nos iframes e allowlist de hosts para `ANY/OneDrive/Dropbox` hoje inexistem (F-FRT-6).
- **Dados:** `api.ts` consome os endpoints do §4.4 com o `api` axios existente. Estados: carregando, vazio, erro com tentar novamente.
- **Formulário:** `PlaySettings` altera `values` (ou estado próprio); `VideoEditor` expõe `inPlay` no `draft`; `buildVideoPagePayload`/`toVideoRequest` incluem os campos aprovados (F-FRM-3). O estado de `isDirty` e a guarda de saída existentes continuam valendo.

---

## 5. Fluxos (PLANEJADOS)
**Admin — criar:** preenche a galeria → define "Modo no Play" → (se "só alguns") marca vídeos → salvar → `POST /video-pages` (mesma transação grava galeria, rota, mídias e Play).
**Admin — editar:** carrega a galeria (traz `play` e `inPlay` por vídeo) → altera modo/marcações → `PATCH /video-pages/:id`.
**Professor:** home da Área do Professor → botão (se a flag permitir) → lista do Play → clica no vídeo → player.
**Regressão:** galeria com `play_scope = 'none'` **não** aparece no Play e **não** muda nada do que existe.

---

## 6. Segurança e privacidade
- **Fato:** `GET /video-pages/:id` e `GET /routes` são públicos (F-API-3/4). Logo, um vídeo marcado só para o Play continua legível por quem tiver o id da galeria (o id aparece em rotas públicas). **O Play não é, por si, um controle de acesso** até P-009 ser decidido.
- O Play lê por endpoints próprios com `JwtAuthGuard` (§4.4); a flag é verificada também no servidor, **mas** `isSwitchedOn` não distingue perfil (F-API-9). Restrição por perfil no servidor exige desenho próprio (**NÃO VERIFICADO** se o serviço de flags oferece leitura por perfil — N5).
- Links externos: hoje a galeria só exige URL HTTP(S) absoluta (`assertMediaLinksAt`); host por plataforma só é validado em `ideas-section` (YouTube). Adotar a mesma validação **é decisão**; sem ela, `ANY` permite embutir qualquer URL em iframe.
- Dados pessoais: nenhum no escopo mínimo. **Se P-008 for aprovado**, progresso/favoritos são dados pessoais do professor, só visíveis ao próprio usuário; sem dados de crianças; logs sem dados pessoais.
- URL do S3: segue exposta como hoje (F-API-7). Mudar a forma de entrega da URL está **fora do escopo** deste plano e nada aqui depende disso.

---

## 7. Fases de entrega
| Fase | Entrega | Depende de |
|---|---|---|
| **0** | Decisões P-001…P-015 fechadas; verificações N1…N6 (§10) | usuário |
| **1** | Banco (autorizado) + `play_scope`/entradas; extensão de `POST/PATCH /video-pages`; leitura `/play/videos`; seção no formulário e caixa por vídeo; botão na home; página do Play e do vídeo; **flag** conforme P-002/P-010 | Fase 0 |
| **2** | Atributos opcionais aprovados (categoria, destaque, ordem, duração/miniatura) | Fase 1; P-006/P-007/P-011 |
| **3** | Engajamento (se P-008) | Fase 2 |

Cada fase é implantável sozinha; a flag (ou o escopo `none`) reverte o comportamento.

---

## 8. Testes e aceite
**API (Jest):** regra de visibilidade (`none`/`all`/`selected`; vídeo novo em `selected` só entra se marcado; vídeo novo em `all` entra; remoção tira do Play); validações do payload com `fieldErrors` por posição; vínculo por posição entre item e mídia criada (N4); transação única (falha reverte galeria **e** Play); `404` para vídeo fora do Play; `401` sem token; flag desligada; paginação/busca; DTO sem `targetId/targetType`.
**App (Vitest/Playwright, sempre com RAM/CPU limitados):** alternância do modo, marcação por vídeo, criação **e** edição, erros por campo, botão na home condicionado à flag, estados vazio/erro/carregando; mobile primeiro (viewport `xs`).
**E2E (regras do projeto: API real, sem mock, login por papel, e-mail desligado, IA fake):** admin cria galeria com 3 vídeos, modo "só alguns" marcando 2 → professor vê 2 e não vê o 3º → admin edita para "galeria inteira" → professor vê 3 → admin muda para "não aparece" → some.
**Aceite:** nenhuma galeria existente muda de comportamento sem ação do admin; professor chega ao Play em 1 toque pela home; criação e edição aplicam a mesma regra; reverter pela flag ou pelo escopo `none`.
**Comandos:** sempre limitados (`nice -n 19 systemd-run --user --scope -p MemoryMax=3G -p CPUQuota=200%`, `--maxWorkers=1`/`--workers=1`, `NODE_OPTIONS=--max-old-space-size=2048`).

---

## 9. Documentação a atualizar junto
`docs/api-video-pages.md` (campo `play`/`inPlay`); nova doc de API do Play; `docs/diagrams/**` (banco e fluxo, com `.png`); docs do app que citam a Área do Professor e vídeos (`docs/teacher_area.md`, `docs/content_materials.md`, `README` de `TeacherArea` e `VideoViewPage`).

---

## 10. Itens NÃO VERIFICADOS — verificar antes de decidir/implementar
| ID | O que falta provar | Como verificar | Muda |
|---|---|---|---|
| N1 | Se `useVideoPageForm`/`VideoPageForm` comportam uma seção a mais e o campo por vídeo sem reescrever rascunho (`draft`) e `isDirty` | Ler `hooks.ts` completo e o fluxo de `VideoEditor.handleSave` | §4.6 |
| N2 | Quantidade real de galerias/vídeos em produção (define paginação, índices e necessidade de cache) | Consulta somente leitura autorizada | Limites e índices |
| N3 | Quem consome `GET /video-pages/:id` e `GET /routes` sem login (site público, `PageRenderer`, e-mails) antes de qualquer restrição | Busca em `clubinhonib-app` e consumidores externos | P-009 |
| N4 | Que `processMediaItemsPolymorphic` devolve as mídias criadas **na mesma ordem** dos itens recebidos (usado para vincular `inPlay` a vídeos sem `id`) | Teste unitário | §4.5 |
| N5 | Se `FeatureFlagsService` oferece leitura por perfil no servidor (hoje só `isSwitchedOn` sem perfil é conhecido) | Ler `get-feature-flags.service.ts` por inteiro | §6, P-010 |
| N6 | Se toda flag nova exige entrada em `FEATURE_PROFILE_RULES`, em `constants/featureFlags.ts` (tipo + default) e em `FeatureFlagKeys` (API) | Ler os arquivos e rodar o type-check | P-010, §4.6 |
| N7 | Se `TeacherAreaSidebar`/`PageRenderer` aceitam rota nova sem mudanças de breadcrumb/ativo | Ler os dois arquivos | §4.6 |
| N9 | Que `src/database/entities.ts` é a lista de entidades usada pelo `DataSource` do `migration:generate` | Ler a configuração do DataSource/CLI | §4.2 |
| N8 | Suporte do navegador a `loadedmetadata`/captura de quadro para os formatos aceitos (para duração/miniatura de upload) | Teste em navegadores-alvo | P-007 |

Nenhuma implementação deve começar antes de P-001…P-004, P-009, P-010, P-014 e P-015 estarem decididos e de N1, N3, N4, N5 e N6 estarem resolvidos.
