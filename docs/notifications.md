# Notification center (bell)

The notification center is a **facade** over existing notice sources. It has no
table of its own: it calls the public service contracts of each source module.
The first (and currently only) persisted source is the feed comment rejection
notice (`feed_photo_comment_notifications`, see
[feed-photo-comments.md](feed-photo-comments.md)). Profile pending items stay
derived in the frontend from the profile/auth domain and are not stored here.

Flow diagram: [`diagrams/flow/notifications/notifications-flow.puml`](diagrams/flow/notifications/notifications-flow.puml).

## Feature flags

| Key | Seed | Effect |
| --- | --- | --- |
| `notification_center_v2` | enabled, `targetRoles: ['admin']` | Enables the facade endpoints for the role. Off → `403 FEATURE_DISABLED`; the frontend keeps the previous bell. No data is changed. |
| `notification_sound` | disabled | Frontend only: offers the in-site sound. Each person still opts in. |
| `browser_notifications` | disabled | Frontend only: offers browser notifications while the site is open. Permission is requested only on click. |

Source flags keep their meaning: when `clubinho_feed` is off for the role, the
facade **omits** that source (empty list/summary, 404 for detail/read) instead
of failing. E-mail flags are unrelated: muting the sound or denying browser
permission never disables an e-mail, and an e-mail flag never hides the center.

## Endpoints (all `JwtAuthGuard`, recipient always from the session)

| Method & path | Input | Output |
| --- | --- | --- |
| `GET /notifications/me/summary` | — | `NotificationSummaryDto` |
| `GET /notifications/me` | `page` (≥1, default 1), `limit` (1..50, default 10), `status` (`all`\|`unread`, default `all`), `type` (`FEED_COMMENT_REJECTED`, optional) | `Paginated<NotificationDto>` + `unreadCount` |
| `GET /notifications/me/:id` | UUID | `NotificationDetailDto` |
| `PATCH /notifications/me/:id/read` | UUID | `NotificationDto` (idempotent; keeps first `readAt`) |
| `PATCH /notifications/me/read-all` | no body | `{ updatedCount, summary }` |

`read-all` is registered before the `:id` routes. Unknown query fields are
rejected by the global `ValidationPipe` (`forbidNonWhitelisted`).

### Contracts

```ts
NotificationDto {
  id: string;                       // same id as the source notice
  type: 'FEED_COMMENT_REJECTED';
  createdAt: string; readAt: string | null;
  title: string; preview: string;   // safe copy, never the comment or reason
  target: { kind: 'FEED_COMMENT'; commentId: string };
}
NotificationDetailDto extends NotificationDto {
  details: { type: 'FEED_COMMENT_REJECTED'; commentText: string; reason: string };
}
NotificationSummaryDto {
  unreadCount: number; total: number;
  revision: string;                 // opaque
  recentUnread: { id: string; type: NotificationType; createdAt: string }[]; // ≤ 10
}
```

The list is intentionally lean; the private comment and reason are only
returned by the owned detail endpoint.

## Rules

- **Ownership:** every query filters by the session recipient. Detail/read of a
  missing or foreign notice return `404 RESOURCE_NOT_FOUND`.
- **Inactive account:** `403 USER_INACTIVE` (unchanged); the frontend stops
  polling and hides private history.
- **Filtering and order:** the `unread` filter is applied in SQL before
  pagination; order is `createdAt DESC, id DESC`. `unreadCount` is the total for
  the recipient, independent of page and filters.
- **Revision:** `feed:<total>:<unread>:<MAX(updatedAt)>` (raw DB text, keeping
  microseconds). It changes on creation, read and deletion. It only signals that
  data should be refetched; it is not an event cursor and does not prove commit
  order. Novelty detection in the frontend compares notice ids from
  `recentUnread`.
- **Bulk read:** inside one transaction, the recipient's unread ids are locked
  (`SELECT … FOR UPDATE`) as a snapshot; only those ids are updated, in batches
  of 500, with `readAt IS NULL` kept in the condition. Notices inserted after the
  snapshot stay unread. Comment texts are not loaded. Profile pending items are
  not affected. The frontend never retries it automatically.
- The legacy `/feed-photo-comments/notifications` routes are unchanged and remain
  available during the migration.

## Not included (planned F7)

Background Web Push (subscriptions, VAPID provider, outbox/worker) is a separate
phase and is not implemented. Browser notifications currently work only while
the site is open.
