# Moderated feed photo and video comments

`feed-photo-comments` is independent from homepage testimonials (`comments`). A
comment belongs to one persisted photo or video UUID in the configured
`FEED_CLUBINHO_PAGE_ID`, not to an album or an arbitrary media URL.

## Access and publication

- All submissions start `pending`, including administrator submissions. Only an
  active administrator can change the status to `approved` or `rejected`.
- Account activity and administrator role are read from the current user record;
  an old token cannot retain permissions after deactivation or role removal.
- Public listing filters `approved` in SQL before pagination. Anonymous access
  additionally requires a public page and section. Active authenticated users
  can view team photos, matching the existing gallery policy.
- Photo/video operations require `clubinho_feed`. Moderation also requires
  `comment_moderation`. The configured feed scope is verified server-side.
- Authors can list and delete their own submissions. Administrators can delete
  any comment in this feed. Deleting a media item/author cascades to its comments;
  deleting a moderator preserves the comment and clears that reference.
- Reasons for rejection are private to the author and administration. Public
  DTOs contain only `id`, `mediaId`, `text`, `authorName` and `createdAt`.
- There is no comment editing or automatic publication. Text is displayed as
  plain text. Rejection email uses its own flag, independently from the in-app inbox.

## Photo and video compatibility

The existing routes and comment tables remain unchanged. `photos/:mediaId` accepts
both IMAGE and VIDEO items from the configured feed; documents and unrelated
media remain inaccessible. No migration or backfill is needed to enable video
comments. Existing photo comments and private rejection notices are preserved.
Moderation adds `mediaType` to its DTO so the client can play a video instead of
rendering it as an image. Legacy `photoUrl` and related field names stay compatible.

## HTTP contract

| Method and path | Access | Input / output |
| --- | --- | --- |
| `GET /feed-photo-comments/photos/:mediaId` | Optional JWT | Paginated approved public DTOs |
| `GET /feed-photo-comments/photos/:mediaId/mine` | Active account | Paginated own DTOs including status, reason and version |
| `POST /feed-photo-comments/photos/:mediaId` | Active account | `{text, requestId}` → pending own DTO |
| `GET /feed-photo-comments/moderation` | Active admin | Paginated admin DTOs with photo and last review metadata |
| `PATCH /feed-photo-comments/:id/moderation` | Active admin | `{status, expectedVersion, reason?}` → own DTO |
| `GET /feed-photo-comments/notifications` | Active recipient | Paginated private snapshots plus `unreadCount` |
| `PATCH /feed-photo-comments/notifications/:id/read` | Active recipient | Notification DTO with persisted `readAt` (idempotent) |
| `DELETE /feed-photo-comments/:id` | Active owner/admin | `{message}` |

Pagination accepts `page >= 1`, `limit` from 1 to 50 (defaults 1/10).
Moderation adds optional `status` and trimmed `searchString` (up to 200
characters), searching author name, text and publication caption. Ordering is
descending creation time and UUID. Unknown request fields are rejected.
Admin photo metadata includes `photoUrl`, `photoTitle`, `photoUploadType` and
nullable `photoPlatformType`, allowing the client to preview cloud links using
the same media rules as the gallery.

Text is trimmed and must contain 1–1000 characters. `requestId` is a UUIDv4
generated for a draft and reused on transport retries. A transaction locks the
author row before checking the unique `(authorId, requestId)` key and the limit
of five submissions per 60 seconds. Identical retries return the original
comment; key reuse with different text/photo returns 409. An approved request
retried later returns its current status, without creating a new comment.

Moderation accepts only `approved` and `rejected`, requires the displayed
positive integer `expectedVersion`, and requires a trimmed reason of 1–500
characters for rejection. Approval can omit the reason. A conditional versioned update prevents stale decisions
from overwriting another administrator's review. Approval clears the rejection
reason. An already rejected comment cannot be rejected again without intervening approval. Rejection also withdraws already published comments. The latest review
records moderator, time and incremented version; it is not a full audit log.

## Errors

All errors use the standard `{success: false, error: ...}` envelope.

| HTTP | Existing code | Condition |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid UUID, empty/oversized text, extra fields, invalid pagination/status/version or absent/blank rejection reason |
| 401 | Authentication codes | Missing or invalid session on protected endpoints |
| 403 | `USER_INACTIVE` | Account deactivated, even if its JWT is still valid |
| 403 | `ROLE_NOT_ALLOWED` | Non-admin moderation |
| 403 | `FEATURE_DISABLED` | Feed/moderation flag unavailable for the actor |
| 404 | `MEDIA_NOT_FOUND` | Unsupported media type, media outside the configured feed, missing media or private anonymous access |
| 404 | `COMMENT_NOT_FOUND` | Missing comment, concurrent deletion, or unauthorized ownership deletion |
| 404 | `RESOURCE_NOT_FOUND` | Feed configuration unavailable or notification missing/not owned |
| 409 | `RESOURCE_CONFLICT` | Stale moderation version, reused request with different payload, or submission rate limit |

## Rejection notifications

The versioned rejection and notification snapshot are committed in the same
transaction. A unique `(commentId, commentVersion)` key prevents duplicate
notices for one review. Each snapshot stores the comment text and reason at that
moment; later approval does not rewrite the notice. Deleting the comment or
recipient cascades to its notices. Existing rejected comments are not backfilled.

Only the active recipient can list or mark notices read; both routes require
`clubinho_feed`. DTOs expose `id`, `commentId`, `commentText`, `reason`,
`createdAt` and nullable `readAt`. The list also returns the total unread count,
independently of pagination. Read updates preserve the first timestamp.

The mobile and desktop navigation bell polls every 30 seconds and refreshes on
focus/open. It combines existing profile alerts with private photo notices.
Opening a notice shows its full text and reason; “Entendi” persists its read
state. Read notices remain in history. Authors also see the reason under their
own rejected comments. Pending/approved comments retain neutral copy with no
triage or approval messaging.

After commit, `CreatePhotoCommentRejectionEmailService` calls the shared
`EmailService.sendFeedPhotoCommentRejected` in the background. It uses
`EmailNotification.FeedPhotoCommentRejected` and the dedicated
`email_feed_photo_comment_rejected` flag (default enabled, no target roles).
The shared dispatch respects inactive accounts and notice opt-outs, escapes
untrusted content, and provides HTML/plain text. Disabling this email flag or
an SMTP failure never suppresses or rolls back the in-app notice. Failed email
delivery follows the existing logged, nonblocking policy; there is no mail retry
queue in this feature.

## Schema and validation

The official TypeORM-generated migration is
`1793668750274-AddFeedPhotoComments.ts`. Deploy using the normal migration
workflow. It creates only the comment table, indexes and foreign keys.
Generation and application validation use an isolated local database because the
existing development watcher had already synchronized the entity; synchronization
is not the deployment procedure. The verified existing local schema was recorded
with the official CLI's fake migration option.

The notification migration `1793728024074-AddPhotoCommentNotifications.ts` was
also generated by the official TypeORM CLI. Local schema comparison showed no
differences after the development watcher synchronized it; its application is
validated against the isolated migration database and recorded locally with
`migration:run --fake` only after verifying the complete schema.

Diagrams: [schema](diagrams/database/feed-photo-comments.puml) and
[flow](diagrams/flow/feed-photo-comments/feed-photo-comments-flow.puml), each
with its rendered PNG beside it.

Backend mocked tests cover account status, roles, DTOs, ownership, visibility,
feature flags, idempotency, transactional writes and optimistic concurrency:

```bash
npm test -- --runInBand feed-photo-comment
```

The frontend's real API/browser automation creates its own teacher and two-photo
publication, then removes its fixtures. The setup disables local email flags.
It covers mobile submission, per-photo drafts, plain text, pending isolation,
admin approval/withdrawal, private reasons, deletion, anonymous access, concurrent
duplicate requests, stale review rejection, required reasons, concurrent rejection
with exactly one notice, owner-only inbox/read, persistent read state, and
deactivation with an existing JWT:

```bash
cd ../clubinhonib-app
npx playwright test e2e/flows/feed-photo-comments.spec.ts --project=chromium
```
