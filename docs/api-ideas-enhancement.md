# Shared ideas: submission, AI review and publication

## Submission and media contract

`POST /ideas-sections` accepts authenticated multipart submission (`sectionData` JSON plus files referenced by `fieldKey`). Its `201` confirms the committed idea, immutable snapshot and original media. Notification and automatic enhancement are detached: their failure cannot revoke that success. An automatic request arriving after publication is rejected.

The sender explicitly selects document, image or video. Up to 20 materials are accepted:

| Type | Input | Per-file limit |
| --- | --- | --- |
| Document | PDF, DOC, DOCX upload | 20 MB |
| Image | JPEG, PNG, WebP, GIF upload | 10 MB |
| Video | MP4, WebM upload or validated YouTube URL | 100 MB |

New documents/images cannot be links. YouTube URLs must use an allowed host and a valid video ID; watch, short links and Shorts are supported. MIME, extension, file size, ownership, duplicate bindings and unbound uploads are validated before S3. Unchanged legacy links remain editable and viewable. New media titles are generated from their type, sequence and idea title; descriptions are empty. Existing custom media titles are preserved.

## Admin endpoints

Queue, details, decisions and manual enhancement require the existing administrator authorization. `idea_ai_enhancement` (seeded **false**; `./run.sh local` creates/enables it locally) governs the **whole** AI flow: with it off there is no automatic enqueue on submission, manual requests/regenerations return `403 FEATURE_DISABLED`, and the worker claims nothing (queued attempts wait until it is back on, or can be cancelled). It never hides moderation: review, cancellation, restoring an earlier result and publishing already generated results keep working. The detail exposes the state as `aiEnhancement.enabled`.

| Endpoint | Behavior |
| --- | --- |
| `GET /ideas-sections` | Pending moderation queue, with nullable `aiStatus`; optional `aiStatus` filter `READY` (result to review, nothing running), `PROCESSING`, `FAILED` (latest attempt failed) or `NONE` |
| `GET /ideas-sections/:id` | Current editable/publication projection plus `aiEnhancement` |
| `POST /ideas-sections/:id/ai-enhancement` | Enqueue an attempt; body `{scope?, mediaIds?, instructions?}` (empty = `FULL`); `202` with `{id, attempt, status}` |
| `DELETE /ideas-sections/:id/ai-enhancement/active` | Cancel the active attempt; `204`; not counted toward the limit |
| `PATCH /ideas-sections/:id/ai-enhancement/:attemptId/current` | Make an earlier `COMPLETED`/`PARTIAL` result the one compared and published; `204` |
| `PATCH /ideas-sections/:id` | Save review and optional version decisions |
| `PATCH /ideas-sections/:id/attach/:pageId` | Publish the chosen projection atomically |
| `DELETE /ideas-sections/:id` | Reject a pending idea and remove its complete asset history |

Detail separates `snapshot`, `activeAttempt`, `currentResult`, `attemptHistory`, `publicationChoices`, `maxAttempts`, `attemptsUsed` (attempts that count toward the limit), `enabled` (the flag) and `providerReady` (provider, key and text model configured; never the key itself). Each attempt also exposes `scope`, `includeText`, `targetMediaIds`, `baseAttempt`, `instructions`, `startedAt`, `progressDone`/`progressTotal` and `countsTowardLimit`; each media result exposes `errorCode` and `carriedOver`; `textGuard.fields` carries the title and description verdicts separately; choices expose `edited`. Original media IDs refer to preserved source rows. `currentResult` changes only after `COMPLETED` or `PARTIAL`; a failed retry keeps the previous successful result. The outer `title`, `description`, `medias` and non-null `pageId` describe the published version. Historical choices include their `enhancementId`, even after another attempt completes. Provider secrets, prompts, provider request identifiers and lease internals are excluded.

A legacy idea has no historical snapshot until capture; its source is `LEGACY_CAPTURE`, never presented as a recovered original submission. Newly submitted ideas use `SUBMISSION`. Enhancement (automatic or manual) is refused for a published idea (`409 IDEA_AI_8624`): its result could no longer be published.

### Targeted regeneration

| `scope` | Redoes | Requires |
| --- | --- | --- |
| `FULL` (default) | Text and every snapshot media | — |
| `TEXT` | Title and description | A current result |
| `MEDIA` | `mediaIds` (uploaded documents/images of the snapshot) | A current result |
| `FAILED` | Rejected/failed text and media of the current result | A current result with something failed |

Partial scopes record the current result as `baseEnhancementId`. On completion, items outside the scope are **carried over** (new result rows pointing to the same artifacts, `carriedOver: true`, no new LLM calls). A redone item that fails or is rejected keeps the base's approved version, flagged with the new `errorCode`. A partial attempt becomes the current result only if something it redid succeeded; otherwise the base stays current. Text is carried per field: a rejected new title keeps the base title.

`instructions` (≤ 500 characters, trimmed) are appended to the text and document prompts after the fixed rules, explicitly subordinate to them; images stay literal. Every attempt still passes the full essence guard.

### Limits and cancellation

Up to **5** attempts count per idea. Cancelled attempts and infrastructure failures (`CANCELLED`, `PROVIDER_NOT_CONFIGURED`, `STALLED`, `SNAPSHOT_MISSING`, `QUEUE_UNAVAILABLE`) do not count. The provider is validated when queuing: a manual request without provider/key/text model returns `400 IDEA_AI_8623`; the automatic enqueue is skipped and logged. Cancelling marks the attempt `SKIPPED/CANCELLED`; calls already sent to the provider finish, but the worker stops at the next item and discards its output.

Publication uses the existing multipart transport. Example `sectionData` fragment (IDs must come from the detail response):

```json
{
  "title": "Current draft title",
  "description": "Current draft description",
  "public": true,
  "medias": [],
  "aiDecisions": {
    "enhancementId": "00000000-0000-4000-8000-000000000001",
    "title": "ENHANCED",
    "description": "ORIGINAL",
    "medias": [
      {
        "sourceMediaId": "00000000-0000-4000-8000-000000000002",
        "decision": "ENHANCED"
      }
    ]
  }
}
```

`aiDecisions.medias` selects which original materials to publish; an omitted source is excluded from publication but retained in the snapshot. `medias` additionally carries retained projection rows or newly uploaded materials. Server-side validation requires decisions to reference the current attempt and an available approved version. The admin UI requires explicit confirmation and resets it when a new result arrives.

`title` and `description` are the **final text** (1–120 and 1–2000 characters, also enforced on `PATCH :id`). With `aiDecisions`, the API publishes them as sent, so the administrator can edit the chosen version; each text choice records `edited: true` when the final text differs from the chosen version (whitespace-insensitive). Before this change the API silently replaced the reviewed text with the snapshot or AI text.

While a job is active, attach returns `409`. Explicit `ignoreAiEnhancement: true` cancels the attempt and publishes the reviewed draft **as sent** (text and materials of the review), without AI decisions. Late results cannot update the published idea.

## Worker and provider behavior

The API starts a worker on bootstrap and polls every 5 seconds. Each process handles one job at a time. A UUID lease lasts 90 seconds, renews every 20 seconds and after each item (recording `progressDone`/`progressTotal`), and is claimed with a conditional database update. Lease deadlines are computed and compared with the MySQL clock, so app/database timezone or clock skew cannot shorten or extend them. Expired work is reclaimable after process failure, at most 3 times (`claimCount`); the next expiry closes the attempt as `FAILED/STALLED` instead of reprocessing (and billing) forever. An attempt whose snapshot disappeared fails with `SNAPSHOT_MISSING`. Queue outages and a missing provider abort the attempt with uncounted codes; other provider errors fail only the affected item, with the item's `errorCode`. Logs record attempt id, outcome and duration (no content). Commit checks both the owner and expiry under the section lock. Publication cancellation, deletion or a replacement owner invalidates results; staged S3 artifacts are cleaned through reference checks.

Every attempt reads the same immutable snapshot, pins provider/model names, and uses current credentials from `ai_provider_settings`. There is no environment model/key configuration and no provider fallback. OpenAI requests use `store: false`. Requests time out after 180 seconds; 429/5xx use bounded exponential retry (at most three retries, honoring the lower Gemini setting). Invalid JSON and invalid DTO outputs are rejected.

- Text: structured rewrite; deterministic checks per field (including 1–120 / ≤2000 characters); one independent LLM judge over the fields that passed. A field rejected by the deterministic checks no longer discards the other.
- Documents: owned S3 download, DOC/DOCX conversion through LibreOffice, maximum 30 pages/60,000 extracted characters, structured content, DOCX and PDF rendering. Essential drawings/templates and unextractable scans are skipped. Only the PDF is selected for public display; the editable DOCX remains available to admins.
- Images: classification first; good images are skipped. People are never sent to generative editing, only deterministic level/sharpness adjustment. Animated images are preserved. Output keeps the original format and a maximum 2048-pixel side. Up to ten source images are considered per attempt.
- **Videos are never enhanced**, whether uploaded or linked (YouTube): they are recorded as `SKIPPED/NOT_SUPPORTED` up front, without download, provider call or counting in the progress, and cannot be targeted by a `MEDIA` regeneration. A skipped video does not make an attempt `PARTIAL`. Legacy external documents/images are also skipped, with no download of arbitrary external URLs.

**Upgrade, not replacement.** The goal is to improve what the teacher shared without losing its central idea, originality or voice. Prompts (`promptVersion` `ideas-enhancement@1.1.0`) ask for corrections, clarity and organization reusing the teacher's own words, and forbid rewriting from scratch, changing the idea, objective or tone, or making it generic. A deterministic **preservation check** then requires that at least 70% of the original keywords (words with 4+ letters, case/punctuation-insensitive; 60% for titles) remain in the proposal, for text and documents; below that the version is rejected with an explicit violation and the original is kept. The LLM judge also rejects proposals whose central idea, objective, tone or originality were lost. Admin instructions cannot override these rules.

The essence guard checks references, numeric facts, proper-name heuristics, new URLs/HTML, length, explicitly detected section/activity labels and numbered-step counts. Images require aspect ratio within 2% and perceptual similarity at least 0.88. A second LLM judge checks semantic preservation. These checks are conservative safeguards, not a guarantee of semantic correctness; the administrator must review every selected version.

## Persistence and cleanup

The five new tables retain submission snapshots, ordered source-media references, attempts, media results (including editable DOCX), and publication choices. Unique nullable active/current section keys enforce one active attempt and one current result. A non-null publication choice key avoids MySQL nullable-unique ambiguity.

Source and enhanced artifacts use dedicated `MediaTargetType` values. Publication rows are separate projections referencing the same S3 objects. Files are deleted only after database commit and only when no media row references the URL. Editing/publishing cannot delete sources or past attempts. Rejecting the idea, deleting its page or removing that section from a page removes all associated history and media, then cleans unreferenced objects. Transaction rollback cleans new uploads without deleting retained sources.

## Migration and rollout

`1794524531633-AddIdeaAiTargetedRegeneration.ts` (generated by the TypeORM CLI against a disposable copy of the local schema) adds scope, targets, base, instructions, claim count and progress to attempts, `error_code`/`carried_over` to media results, `edited` to publication choices, and the new error codes. Existing attempts default to `FULL`, `include_text = 1`, counters 0.

`1794240905149-AddIdeasSectionAiEnhancements.ts` was generated by the official TypeORM CLI against an isolated local database using the repository's registered entities. It only adds the five AI tables and their constraints. No existing idea/media schema is changed. Earlier local development migration drafts were consolidated before delivery; do not deploy those drafts.

The development application database already contained the schema from its pre-existing synchronize configuration. A read-only TypeORM schema check confirmed no diff; its migration ledger was reconciled with `--fake`. This is specific to that local database, not the deployment procedure.

For staging/production, apply the migration normally **before** starting the API, keep automatic enhancement disabled, then release the app. Verify LibreOffice and provider configuration. Enable the automatic flag only after the human/provider QA below. Deployment and remote database changes are outside this implementation.

## Validation and remaining rollout QA

Automated tests cover validation, immutable capture, manual/automatic enqueue, attempt limits, cancellation, stale choices, partial/failure retention, removed materials, media guards, safe output mapping and tracked cleanup. Browser tests mock the API and cover comparison, retry, publish confirmation, explicit type selection, YouTube, success/retry and 390/1440-pixel layouts. They do not call paid provider endpoints or S3.

Before enabling automatic processing in a shared environment, complete the plan's real-provider checks for OpenAI and Gemini, restart recovery against real jobs, S3 audit after rejection, Android/iOS accessibility, and independent review of ten real ideas by two people. These require operational/human validation and are not marked as completed by mocked tests.
