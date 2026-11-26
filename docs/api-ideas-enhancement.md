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

Queue, details, decisions and manual enhancement require the existing administrator authorization. `idea_ai_enhancement` (seeded **false**; `./run.sh local` creates/enables it locally) governs the **whole** AI flow: with it off there is no automatic enqueue on submission, manual requests/regenerations return `403 FEATURE_DISABLED`, and the worker claims nothing (queued attempts wait until it is back on, or can be cancelled). It never hides moderation: the idea can still be reviewed and published with its original content. AI results are hidden while it is off (see below) and come back when it is turned on again.

| Endpoint | Behavior |
| --- | --- |
| `GET /ideas-sections` | Pending moderation queue, with nullable `aiStatus`; optional `aiStatus` filter `READY` (result to review, nothing running), `PROCESSING`, `FAILED` (latest attempt failed) or `NONE` |
| `GET /ideas-sections/:id` | Current editable/publication projection plus `aiEnhancement` |
| `POST /ideas-sections/:id/ai-enhancement` | Enqueue an attempt; body `{scope?, mediaIds?, instructions?}` (empty = `FULL`); `202` with `{id, attempt, status}` |
| `DELETE /ideas-sections/:id/ai-enhancement/active` | Cancel the active attempt; `204`; not counted toward the limit |
| `PATCH /ideas-sections/:id/ai-enhancement/:attemptId/current` | Make an earlier `COMPLETED`/`PARTIAL` result the one compared and published; `204` |
| `GET /ideas-sections/:id/ai-enhancement/medias/:sourceMediaId/document` | The enhanced document of the **current** result as editor content (TipTap JSON): `{enhancementId, sourceMediaId, document, source, editedAt}`. `source` is `STORED` (JSON kept when the AI generated or an admin saved) or `EXTRACTED` (older result: text taken from the enhanced PDF) |
| `PUT /ideas-sections/:id/ai-enhancement/medias/:sourceMediaId/document` | Saves a hand-edited document `{enhancementId, document}`: validates it, renders a new DOCX + PDF (LibreOffice), replaces the result files and returns the same body as `GET`. `409` if `enhancementId` is no longer the current attempt, the idea is published or the AI is working; `422` `IDEA_AI_8629` for an invalid document; `404` `IDEA_AI_8628` when there is no enhanced document |
| `PATCH /ideas-sections/:id` | Save review and optional version decisions |
| `PATCH /ideas-sections/:id/attach/:pageId` | Publish the chosen projection atomically |
| `DELETE /ideas-sections/:id` | Reject a pending idea and remove its complete asset history |

With the `idea_ai_enhancement` flag off, every `/ideas-sections/:id/ai-enhancement*` endpoint returns 403 (`FEATURE_DISABLED`, `IdeaAiEnabledGuard`), `GET /ideas-sections/:id` omits `aiEnhancement`, and the pending queue returns `aiStatus: null` and ignores the `aiStatus` filter.

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

- **The idea as a whole.** Before any item is improved, the worker builds one shared context (`GetIdeaAiContextService`): the title, the description and, for each uploaded document, its extracted text (at most 3,000 characters each and 9,000 in total; images enter by name only). The text step receives the materials as context so the title and description stay consistent with the files (same names and terms, easy to apply), and each document step receives the title and description so it keeps the same vocabulary and never contradicts them. Each document is downloaded and converted once and the prepared PDF is reused by its own step. The context is read-only: facts, numbers, materials or steps that exist only in a file are never added to the description (the deterministic guard rejects them). A file that cannot be read for context never fails the attempt; the document step retries and reports its own error.
- Text: structured rewrite; deterministic checks per field (including 1–120 / ≤2000 characters); one independent LLM judge over the fields that passed. A field rejected by the deterministic checks no longer discards the other.
- Documents: owned S3 download, DOC/DOCX conversion through LibreOffice, maximum 30 pages/60,000 extracted characters, structured content, DOCX and PDF rendering. **Visual PDFs are cleaned, without AI.** A PDF with no text layer (a scanned page or a Canva template whose content is the picture) **or with text plus embedded images of 200×200 px or more** (smaller logos and icons are ignored; e.g. a word-search grid) is not sent to the provider: a text-only rewrite would lose the images. Each page (up to 10) is rasterized at 150 dpi with `pdftoppm` (**poppler-utils must be installed on the host**; without it the document is kept as sent and a warning is logged), gets the same deterministic adjustment as photos (level normalization and light sharpening), is checked page by page for aspect ratio and similarity with the original, and the PDF is rebuilt with the pages as JPEG (`buildImagePdf`, no dependency). The result is `ENHANCED` with only the PDF artifact: no DOCX and no editable document, so the review screen offers no hand-editing for it, and the text stops being selectable. The images are detected deterministically by reading the PDF bytes (`countPdfImages`: image XObject dictionaries are plain text outside compressed object streams); the `pdf-parse` pdf.js build cannot list images in Node because it loads fonts and crashes the process. A PDF the text parser could not open, one with more than 10 pages, or a host without `pdftoppm` is kept as sent (`SKIPPED/ESSENTIAL_VISUALS`) and is never flattened. Only PDFs with text and **no** relevant images go through the AI rewrite below. The model may still flag `hasEssentialVisuals` on its own. The review screen warns, next to every AI version, that it contains text only. Essential drawings/templates and unextractable scans (image-only PDFs, with no text layer) are skipped without calling the provider and published exactly as sent. Every item that is skipped or fails is logged with its reason (`SKIPPED (ESSENTIAL_VISUALS)`, `FAILED (code)`), so a successful request no longer hides why a file was not improved. Only the PDF is selected for public display; the editable DOCX remains available to admins.
- Images: classification first; good images are skipped. People are never sent to generative editing, only deterministic level/sharpness adjustment. Animated images are preserved. Output keeps the original format and a maximum 2048-pixel side. Up to ten source images are considered per attempt.
- **Videos are never enhanced**, whether uploaded or linked (YouTube): they are recorded as `SKIPPED/NOT_SUPPORTED` up front, without download, provider call or counting in the progress, and cannot be targeted by a `MEDIA` regeneration. A skipped video does not make an attempt `PARTIAL`. Legacy external documents/images are also skipped, with no download of arbitrary external URLs.

**Upgrade, not replacement.** The goal is to improve what the teacher shared without losing its central idea, originality or voice. Prompts (`promptVersion` `ideas-enhancement@1.3.0`) ask for corrections, clarity and organization reusing the teacher's own words, and ask for the idea to be documented clearly, in simple language, so any teacher can understand and apply it in their club — using only what the teacher wrote, never adding steps, materials, goals, examples or verses — and forbid rewriting from scratch, changing the idea, objective or tone, or making it generic. A deterministic **preservation check** then requires that at least 70% of the original keywords (words with 4+ letters, case/punctuation/accent-insensitive; 60% for titles) remain in the proposal, for text and documents; below that the version is rejected with an explicit violation and the original is kept. Spelling fixes count as the same word: words with 6+ letters tolerate 1 differing letter and 8+ letters tolerate 2, so "oracao" → "oração" or "materiaes" → "materiais" is not drift, while short words ("bola" → "bala") must match exactly. Proper-name checks ignore accents too. The LLM judge also rejects proposals whose central idea, objective, tone or originality were lost. Admin instructions cannot override these rules.

The essence guard checks references, numeric facts, proper-name heuristics, new URLs/HTML, length, explicitly detected section/activity labels and numbered-step counts. Images require aspect ratio within 2% and perceptual similarity at least 0.88. A second LLM judge checks semantic preservation. These checks are conservative safeguards, not a guarantee of semantic correctness; the administrator must review every selected version.

## Failure causes and observability

`PROVIDER_REQUEST_FAILED` is the catch-all code for any unexpected error while processing a text or a media item (it is an enum column, so it is not split by cause). To keep the real cause visible, the worker logs every failed item with `Logger.error` (`Melhoria <attempt>: falha em material <id> — <ErrorName>: <message>` plus the stack), which the observability pipeline stores. Before this log a code error looked like "the provider did not respond in time". Known case: `import sharp from 'sharp'` compiles to `sharp_1.default(...)` in this CommonJS build and is `undefined`; the module must use `src/modules/ai-lessons/utils/sharp.utils`. `idea-image-transform.provider.spec.ts` runs the real sharp so that mistake cannot come back unnoticed.

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

## Hand-editing an enhanced document

The editor is isolated from the Studio: the module has its own TipTap → DOCX converter (`IdeaTiptapDocxProvider`) and never imports the Studio exporter. It only shares the generic LibreOffice conversion service.

- The AI result is stored twice: the generated PDF/DOCX (`enhancedMedia`/`editableMedia`) and the editor content in `ideas_section_ai_media_enhancements.editable_document_json` (plus `document_edited_at` once an admin edits). The PDF and DOCX are always rendered from that same content.
- The AI essence guard does **not** run on a human edit: the administrator is accountable for it. The UI shows the original next to the editor.
- **S3 safety:** new files upload before the transaction and are discarded if it fails. The old files leave the bucket only after commit and only when no other attempt result still references them (regenerations carry results over), so nothing is orphaned and nothing in use is deleted.
- The document must have only the supported nodes (paragraph, heading, lists, blockquote, rule, code block, table), at most 40 levels, 20 000 nodes, 2 MB and 60 000 characters; links are limited to `http(s)` and `mailto`.
