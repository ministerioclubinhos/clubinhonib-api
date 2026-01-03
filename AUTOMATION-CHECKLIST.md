# Checklist de Automações (Criação + Listagem/Fix) — Clubinho NIB API

## Como rodar

- **Tudo em sequência**: `node scripts/run-all-testes.js`
- Variáveis opcionais:
  - `API_BASE_URL` (default: `http://localhost:3000`)
  - `SUPERUSER_EMAIL` (default: `superuser@clubinhonib.com`)
  - `SUPERUSER_PASSWORD` (default: `Abc@123`)
  - `ACADEMIC_YEAR` (default: `2025`)
  - `USERS_TO_CREATE` (default: `20`)
  - `MIN_CLUBS` (default: `10`)
  - `MIN_TEACHERS_PER_CLUB` (default: `10`)
  - `CHILDREN_PER_CLUB` (default: `10`)
  - `WEEKS` (default: `auto` — calcula pelo período letivo em `/club-control/periods/:year`)
  - `PAGELAS_CHILD_LIMIT` (default: `0` = todas as crianças)
  - `PAGELAS_DEBUG` (default: `false`)
  - `PAGELAS_CHILD_ID` (default: vazio)
  - `MIN_PAGES_ITEMS` (default: `10` — mínimo de itens a criar para controllers de páginas/conteúdo)

## Scripts úteis (pagelas)

- **Completar pagelas faltantes para o ano letivo inteiro (todas as crianças)**: `node scripts/fix-missing-pagelas-full-year.js`
- **Criar pagelas somente para crianças com total=0 (ano letivo inteiro)**: `node scripts/fix-zero-pagelas-all-children.js`
- **Achar 1 criança sem pagelas (para debug)**: `node scripts/find-child-without-pagelas.js`

## Regras (importante)

- **Toda listagem paginada deve percorrer todas as páginas** (page 1..N).
- Ao detectar inconsistência na listagem, a automação deve **corrigir via endpoint de edição** (PATCH/PUT) quando existir.
- Cada “entidade/controller” deve ter 2 automações:
  - **Criação** (`create`)
  - **Listagem + Fix** (`list-fix`)

---

## Controllers encontrados (source of truth)

### API / Domínio (módulos)

- [x] `src/auth/auth.controller.ts`
  - [x] create (`scripts/automations/auth/create.js`)
  - [x] list-fix (`scripts/automations/auth/list-fix.js`)
  - [x] paginação (N/A)

- [x] `src/user/user.controller.ts`  (users)
  - [x] create (`scripts/automations/users/create.js`)
  - [x] list-fix (`scripts/automations/users/list-fix.js`)
  - [x] paginação (via `fetchAllPages`)

- [x] `src/modules/clubs/clubs.controller.ts` (clubs)
  - [x] create (`scripts/automations/clubs/create.js`)
  - [x] list-fix (`scripts/automations/clubs/list-fix.js`)
  - [x] paginação (via `fetchAllPages`)

- [x] `src/modules/children/children.controller.ts` (children)
  - [x] create (`scripts/automations/children/create.js`)
  - [x] list-fix (`scripts/automations/children/list-fix.js`)
  - [x] paginação (via `fetchAllPages`)

- [x] `src/modules/pagelas/pagelas.controller.ts` (pagelas)
  - [x] create (`scripts/automations/pagelas/create.js`)
  - [x] list-fix (`scripts/automations/pagelas/list-fix.js`)
  - [x] paginação (`/pagelas/paginated` via `fetchAllPages`)

- [x] `src/modules/teacher-profiles/teacher-profiles.controller.ts` (teacher-profiles)
  - [x] create (via `/users` role=teacher) (`scripts/automations/teacher-profiles/create.js`)
  - [x] list-fix (`scripts/automations/teacher-profiles/list-fix.js`)
  - [x] paginação (via `fetchAllPages`)

- [x] `src/modules/coordinator-profiles/coordinator-profiles.controller.ts` (coordinator-profiles)
  - [x] create (via `/users` role=coordinator) (`scripts/automations/coordinator-profiles/create.js`)
  - [x] list-fix (`scripts/automations/coordinator-profiles/list-fix.js`)
  - [x] paginação (via `fetchAllPages`)

- [x] `src/modules/club-control/controllers/club-control.controller.ts` (club-control)
  - [x] create (periods) (`scripts/automations/club-control/create.js`)
  - [x] list-fix (periods/exceptions + smokes) (`scripts/automations/club-control/list-fix.js`)
  - [x] paginação (periods/exceptions via `fetchAllPages`)

- [x] `src/modules/accepted-christs/controllers/accepted-christ.controller.ts` (accepted-christs)
  - [x] create (`scripts/automations/accepted-christs/create.js`)
  - [x] list-fix (N/A) (`scripts/automations/accepted-christs/list-fix.js`)

- [x] `src/modules/statistics/statistics.controller.ts` (statistics)
  - [x] create (N/A) (`scripts/automations/statistics/create.js`)
  - [x] list-fix (`scripts/automations/statistics/list-fix.js`)
  - [x] paginação (quando aplicável, via `fetchAllPages`)

- [x] `src/modules/addresses/addresses.controller.ts` (addresses)
  - [x] create (N/A: controller vazio)
  - [x] list-fix (N/A: controller vazio)

### Outros Controllers (conteúdo / site)

- [x] `src/route/route.controller.ts`
  - [x] create (N/A: só GET) (`scripts/automations/routes/create.js`)
  - [x] list-fix (`scripts/automations/routes/list-fix.js`)
  - [x] paginação (N/A)

- [x] `src/pages/week-material-page/week-material-page.controller.ts`
  - [x] create (`scripts/automations/week-material-pages/create.js`)
  - [x] list-fix (`scripts/automations/week-material-pages/list-fix.js`)

- [x] `src/pages/video-page/video-page.controller.ts`
  - [x] create (`scripts/automations/video-pages/create.js`)
  - [x] list-fix (`scripts/automations/video-pages/list-fix.js`)

- [x] `src/pages/image-section/Image-section-controller.ts`
  - [x] create (`scripts/automations/image-sections/create.js`)
  - [x] list-fix (`scripts/automations/image-sections/list-fix.js`)

- [x] `src/pages/image-page/image-page.controller.ts`
  - [x] create (`scripts/automations/image-pages/create.js`)
  - [x] list-fix (inclui paginação em `/:id/sections`) (`scripts/automations/image-pages/list-fix.js`)

- [x] `src/pages/ideas-section/ideas-section.controller.ts`
  - [x] create (`scripts/automations/ideas-sections/create.js`)
  - [x] list-fix (`scripts/automations/ideas-sections/list-fix.js`)

- [x] `src/pages/ideas-page/ideas-page.controller.ts`
  - [x] create (`scripts/automations/ideas-pages/create.js`)
  - [x] list-fix (`scripts/automations/ideas-pages/list-fix.js`)

- [x] `src/pages/event-page/event.controller.ts`
  - [x] create (`scripts/automations/events/create.js`)
  - [x] list-fix (`scripts/automations/events/list-fix.js`)

- [x] `src/meditation/meditation.controller.ts`
  - [x] create (`scripts/automations/meditations/create.js`)
  - [x] list-fix (`scripts/automations/meditations/list-fix.js`)

- [x] `src/informative/informative.controller.ts`
  - [x] create (`scripts/automations/informatives/create.js`)
  - [x] list-fix (`scripts/automations/informatives/list-fix.js`)

- [x] `src/feedback/site-feedback.controller.ts`
  - [x] create (`scripts/automations/site-feedbacks/create.js`)
  - [x] list-fix (`scripts/automations/site-feedbacks/list-fix.js`)

- [x] `src/documents/documents.controller.ts`
  - [x] create (`scripts/automations/documents/create.js`)
  - [x] list-fix (`scripts/automations/documents/list-fix.js`)

- [x] `src/contact/contact.controller.ts`
  - [x] create (`scripts/automations/contact/create.js`)
  - [x] list-fix (`scripts/automations/contact/list-fix.js`)

- [x] `src/comment/comment.controller.ts`
  - [x] create (`scripts/automations/comments/create.js`)
  - [x] list-fix (`scripts/automations/comments/list-fix.js`)

- [x] `src/app.controller.ts`
  - [x] create (N/A)
  - [x] list-fix (`scripts/automations/site-smoke/list-fix.js`)


