# Automation Checklist (Creation + Listing/Fix) — Clubinho NIB API

## Feed photo comment regression

With both local applications running, execute
`npx playwright test e2e/flows/feed-photo-comments.spec.ts --project=chromium`
from `../clubinhonib-app`. It creates and cleans its own fixtures and exercises
the API plus the actual author/admin interfaces. See
[coverage and setup details](feed-photo-comments.md#schema-and-validation).

The regression covers required rejection reasons, one notification per concurrent
review, owner-only inbox/read endpoints, mobile bell details and persistent read
state. Shared email tests verify the dedicated flag blocks SMTP and transport
failure leaves the operation successful. The local E2E setup disables email flags.

Raw Node.js scripts under `scripts/automations/` that populate a running API
with realistic data and exercise every endpoint contract, including the role
and scope rules. They are the executable counterpart of the API docs: when a
contract changes, the matching automation must change with it.

## How to run

- **Everything, in order**: `node scripts/run-all-testes.js` (or `npm run test:all`)
- **Only some modules** (prefix match on the step name):
  `node scripts/run-all-testes.js clubs children/create pagelas`
  The `users/create` step always runs first because it opens the per-role sessions
  the other steps use.
- **Seed the superuser only** (local database):
  `node scripts/automations/bootstrap/seed-superuser.js` (or `npm run automation:seed-superuser`)
- Exit code is `1` when any scenario failed; the run ends with a
  `RESUMO ok=… warn=… fail=…` line listing every failure.

### Bootstrap of the superuser

`POST /auth/register` creates an **inactive** account (e-mail confirmation) and
`POST /users` requires an administrator, so the suite cannot bootstrap itself
through the API. When the superuser login fails with 401 and `DB_HOST` in the
env file is local, `run-all` seeds `SUPERUSER_EMAIL`/`SUPERUSER_PASSWORD` as an
active admin directly in MySQL (using the API's own `mysql2` and `bcryptjs`)
and retries. Set `AUTO_SEED_SUPERUSER=false` to disable it. The seed refuses any
non-local `DB_HOST`.

### Environment variables

| Variable | Default | Meaning |
|----------|---------|---------|
| `API_BASE_URL` | `http://localhost:3000` | API under test |
| `SUPERUSER_EMAIL` / `SUPERUSER_PASSWORD` | `superuser@clubinhonib.com` / `Abc@123` | Admin session used by the suite |
| `ENV_FILE` | `env/local.env` | Env file read by the superuser seed |
| `AUTO_SEED_SUPERUSER` | `true` | Seed the superuser in the local DB when login fails |
| `AUTOMATION_PASSWORD` | `Senha123@` | Password of every user the suite creates |
| `AUTOMATION_EMAIL_DOMAIN` | `teste.clubinhonib.com` | Domain of generated e-mails (used to recognise suite data) |
| `ACADEMIC_YEAR` | current year | Academic period used for pagelas |
| `USERS_TO_CREATE` | `12` | Random users created on top of the fixed role users |
| `MIN_CLUBS` | `6` | Minimum number of clubs |
| `MIN_TEACHERS_PER_CLUB` | `3` | Teachers guaranteed per club by `clubs/list-fix` |
| `CHILDREN_PER_CLUB` | `10` | Children guaranteed per club |
| `WEEKS` | `0` (= computed from the period dates) | Weeks of pagelas per child |
| `MIN_PAGES_ITEMS` | `5` | Minimum items for content modules (pages, documents, banners…) |
| `PAGELAS_CHILD_LIMIT` / `PAGELAS_CHILD_ID` / `PAGELAS_DEBUG` | `0` / empty / `false` | Narrow or debug the pagela generation |
| `THROTTLE_MS` | `5` | Pause between requests in large batches |
| `FFMPEG_PATH` | empty | ffmpeg binary used to regenerate the encoded fixtures |

## Fixed users, one per role scenario

`users/create` guarantees these accounts (idempotent, found again by e-mail; an
admin is found by logging in, since `GET /users` hides administrators) and logs
a session for each active one. Every module then runs its happy path as the
superuser and checks what each other role can and cannot do.

| Key | E-mail | Role | Scenario |
|-----|--------|------|----------|
| `admin` | `admin.automation@…` | admin | Second administrator created through the API |
| `coordinator` | `coordinator.automation@…` | coordinator | Owns the anchor club (and the clubs it creates) |
| `coordinatorNoClubs` | `coordinator.semclube.automation@…` | coordinator | Coordinator without clubs: sees nothing scoped |
| `teacher` | `teacher.automation@…` | teacher | Linked to the anchor club |
| `teacherUnlinked` | `teacher.semclube.automation@…` | teacher | Links itself with `POST /auth/link-club` |
| `teacherInactive` | `teacher.inativo.automation@…` | teacher | Inactive account: login returns no tokens |
| `googleLike` | `coordinator.google.automation@…` | coordinator | `commonUser=false`: changes password without the current one |

Plus an anonymous client for the public routes and the `401` checks.

## Real files

Uploads use real, small files (see `scripts/automations/common/fixtures.js`):

- Generated at run time with no dependency: PNG (zlib), PDF, DOCX (zip), WAV, TXT, CSV.
- Encoded with ffmpeg and committed under `scripts/automations/fixtures/` (~5–9 KB
  each): `sample.mp4` (H.264, 160×120, 2 s), `sample.mp3`, `sample.jpg`.
  `regenerateEncodedFixtures()` rebuilds them when `FFMPEG_PATH` or `ffmpeg` is
  available.

Every upload goes to S3 through the API, so the bucket configured in the env
file receives real objects.

## Rules (important)

- **Every paginated listing must traverse all pages** (page 1..N) — `fetchAllPages`
  understands every pagination shape the API returns (`{ data, total, pageCount }`,
  `{ items, total }`, `{ data, meta }`, `{ items, meta }`, `{ <key>, pagination }`).
- When inconsistency is detected in a listing, automation must **fix via edit
  endpoint** (PATCH/PUT) when available, and only on data the suite itself owns
  (e-mails under `AUTOMATION_EMAIL_DOMAIN`).
- Each "entity/controller" has 2 automations: **Creation** (`create`) and
  **Listing + Fix** (`list-fix`).
- Every scenario runs through `logger.check(label, fn)`: a failure is recorded
  and the suite keeps going. Negative scenarios use `expectHttpError(fn, status)`
  and fail when the API answers a different status **or passes**.
- `DELETE` scenarios only remove entities the same run created for that purpose.

---

## Controllers covered (source of truth)

### Core

- [x] `src/core/auth/auth.controller.ts` — `auth/create` (register → inactive, duplicate 409, inactive login without tokens, resend-verification), `auth/list-fix` (me per role, refresh, logout, reset-token validate, forgot-password, teacher `link-club`).
- [x] `src/core/user/user.controller.ts` — `users/create` (fixed role users + random batch, 409/whitelist/403), `users/list-fix` (all pages, filters, detail, PUT, `PATCH :id/image` upload PNG and link, non-image rejected, DELETE, 403/401).
- [x] `src/core/user/profile.controller.ts` (`/profile`) — `profile/create` (upload PNG per role, link, 401), `profile/list-fix` (GET vs `/auth/me`, PATCH, password change with and without current password, whitelist).
- [x] `src/core/profile/controllers/profile.controller.ts` (`/profiles`) — `profiles/create` (personal data + preferences per role), `profiles/list-fix` (all pages, filters, birthdays, `me`, `:id` admin-only, DELETE, 403).
- [x] `src/core/feature-flags/feature-flags.controller.ts` — `feature-flags/create` (seed, create, invalid key, 409, 403), `feature-flags/list-fix` (all pages, filters, stats, map per role and anonymous, check, PATCH, toggle, DELETE 204, 404).
- [ ] `src/core/user/email-preferences.controller.ts` — N/A: `POST /email-preferences/unsubscribe` needs a token signed by the API (`EMAIL_UNSUBSCRIBE_SECRET`).

### Domain

- [x] `src/modules/club-control/controllers/club-control.controller.ts` — `club-control/create` (period for `ACADEMIC_YEAR`, duplicates, exceptions of every type), `club-control/list-fix` (PUT period, all pages, exception cycle with idempotent soft delete, current-week, dashboard, check/week, check/club, indicators, 403/401).
- [x] `src/modules/clubs/clubs.controller.ts` — `clubs/create` (anchor club with fixed coordinator and teacher, minimum count, coordinator self-assignment, validations, duplicate-number probe as warning), `clubs/list-fix` (all pages, filters, ensures coordinator + minimum teachers, `all`, `simple-options`, PATCH/toggle/DELETE cycle, teacher/coordinator scope).
- [x] `src/modules/teacher-profiles/teacher-profiles.controller.ts` — `teacher-profiles/create`, `teacher-profiles/list-fix` (all pages, filters, simple, by-club, assign/move/unassign, fix unlinked automation teachers, coordinator scope, 403).
- [x] `src/modules/coordinator-profiles/coordinator-profiles.controller.ts` — `coordinator-profiles/create` (new club for the new coordinator, 409 on occupied club, 403), `coordinator-profiles/list-fix` (all pages, filters, simple, by-club, move-club/unassign, 403).
- [x] `src/modules/children/children.controller.ts` — `children/create` (per club with `joinedAt` inside the period, without club, validations, teacher scope 403), `children/list-fix` (all pages, filters, `simple` + `acceptedChrist`, detail, PUT/toggle/DELETE cycle, fix missing `joinedAt`, teacher/coordinator scope).
- [x] `src/modules/pagelas/pagelas.controller.ts` — `pagelas/fix-zero`, `pagelas/create` (every academic week from `joinedAt`, week derived from `referenceDate`, 409 duplicate, out-of-period, explicit week/year, notes limit, teacher scope), `pagelas/list-fix` (fix missing weeks, `/pagelas` and `/pagelas/paginated` with filters, PATCH, DELETE, scopes).
- [x] `src/modules/accepted-christs/controllers/accepted-christ.controller.ts` — `accepted-christs/create` (ACCEPTED / RECONCILED / unspecified, teacher scope), `accepted-christs/list-fix` (read through `/children/simple?acceptedChrist=` and `/statistics/accepted-christs`).
- [x] `src/modules/statistics/statistics.controller.ts` — `statistics/create` (N/A), `statistics/list-fix` (every GET with filters, all pages of clubs/children/teachers, attendance, 403/401).
- [x] `src/modules/addresses` — N/A: no controller.

### Content / site

- [x] `src/modules/comments/comment.controller.ts` — create per role, list all pages + filters, unpublished-count, PUT, publish/unpublish, DELETE, public `/comments/published`.
- [x] `src/modules/contacts/contact.controller.ts` — public POST (persistence verified even if the e-mail fails), list + filters, unread-count, read/unread, DELETE.
- [x] `src/modules/feedbacks/site-feedback.controller.ts` — create per role (author from token), list + filters, unread-count, PUT, read/unread, DELETE.
- [x] `src/modules/informatives/informative.controller.ts` — create, list + filters, PATCH (no `id` in body), DELETE 204, teacher read-only.
- [x] `src/modules/documents/documents.controller.ts` — uploads (PDF, DOCX, TXT, CSV) and link, list + `hasMedia`, public detail, PATCH keeping and replacing the file, DELETE 204.
- [x] `src/modules/meditations/meditation.controller.ts` — Monday–Friday weeks with MP3 upload and link, overlap 409, weekday/days validations, list + `period` filter, this-week, PATCH (days and new audio), DELETE 204.
- [x] `src/modules/pages/event-page/event.controller.ts` — JPG/PNG cover, link cover and no media, audience/type, anonymous vs logged listing, upcoming, PATCH with new cover, DELETE 204.
- [x] `src/modules/pages/ideas-page/ideas-page.controller.ts` — sections with YouTube links, PDF and PNG uploads, list + filters, public detail, PATCH (keep by id / create with upload / remove), DELETE 204.
- [x] `src/modules/pages/ideas-section/ideas-section.controller.ts` — teacher submissions (PDF/DOC/DOCX, JPG/PNG/WEBP/GIF, MP4/WEBM and YouTube links), 20-item and per-file limits, queue + pending-count, PATCH preserving legacy media, attach to a page, DELETE.
- [x] `src/modules/pages/image-page/image-page.controller.ts` — galleries with PNG/JPG uploads and links, list + filters, public detail, paginated sections (anonymous sees only public ones, limit cap), PATCH, DELETE 204.
- [x] `src/modules/pages/image-section/image-section.controller.ts` — photos sent by teacher/coordinator, review queue (`approved`, `hasMedia`), pending-count, approval via PATCH, DELETE.
- [x] `src/modules/pages/video-page/video-page.controller.ts` — YouTube links + MP4 upload, list + filters, public detail, PATCH (keep uploads by id, add MP4), DELETE 204.
- [x] `src/modules/pages/week-material-page/week-material-page.controller.ts` — videos (link + MP4), documents (PDF, DOCX), images (PNG), audios (MP3); list + `currentWeek`; publish/switch current week; PATCH keeping media by id; DELETE.
- [x] `src/modules/routes/route.controller.ts` — public list, detail, 404.
- [x] `src/app.controller.ts` + public surface — `site-smoke/list-fix` (`/`, `/health`, public routes, public details, every protected route answers 401 anonymously).

---
⬅️ [Back to Documentation Hub](README.md)

## Shared idea enhancement verification

- Submit supported multipart media and verify `201` without waiting for provider/notification promises; reject mismatched MIME/extensions, forged YouTube hosts and foreign media IDs before upload.
- With automatic flag off, manually `POST /ideas-sections/:id/ai-enhancement` as admin and expect `202`; a concurrent request and a fourth attempt return `409`.
- Fetch detail and compare immutable snapshot, active/current/history and publication choices. Failed retries must keep the preceding current result.
- Attach with current `aiDecisions`; verify mixed choices and removed materials in the public projection, with original sources retained.
- Attach during processing: first expect `409`; then send explicit `ignoreAiEnhancement: true`, verify original publication and rejection of late worker artifacts.
- Reject/remove the section or delete its page, and verify post-commit reference-checked cleanup. Provider and S3 unit tests remain mocked.
- Complete the real-provider/human rollout checklist in [shared idea enhancement](api-ideas-enhancement.md) before enabling automatic processing.
