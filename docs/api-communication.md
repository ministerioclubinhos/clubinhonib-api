# Communication API Documentation

This module covers the three inbound channels of the site: site feedback,
public comments and the contact form.

## 📋 Index

1. [What the three have in common](#what-the-three-have-in-common)
2. [Site Feedbacks](#1-site-feedbacks)
3. [Comments](#2-comments)
4. [Contacts](#3-contacts)

---

## What the three have in common

All three listings are **paginated and filtered by the API**. They used to
return every row at once and let the browser filter; the admin screens now send
the search and the filters as query parameters.

Every listing answers the shared envelope:

```typescript
{
  data: T[];
  total: number;
  page: number;
  limit: number;
  pageCount: number;
}
```

And every listing accepts the same shape of query:

| Parameter | Type | Notes |
| --- | --- | --- |
| `page` | number | Default `1`. |
| `limit` | number | Default `12`, max `100`. |
| `searchString` | string | Case-insensitive, matched in the database. |
| `sort` | string | One of the module's sort fields. |
| `order` | `ASC` \| `DESC` | Case-insensitive on input. |

Deletes answer `{ "message": "..." }`. Ids are UUIDs and are validated as such.

---

## 1. Site Feedbacks

**Base URL**: `/site-feedbacks`

A rating of the site left by a signed-in user.

### `POST /site-feedbacks`

- **Access**: any authenticated user.
- The author is taken **from the token**. `name` and `email` are not accepted in
  the body — accepting them would let anyone sign a review as someone else.

```typescript
{
  rating: number;               // 1–5
  comment: string;
  category: FeedbackCategory;   // content, appearance, usability, broken_feature,
                                // missing_feature, performance, mobile_experience,
                                // suggestion, complaint, other
}
```

### `GET /site-feedbacks`

- **Access**: admin only.
- **Filters**: `searchString` (name, e-mail, comment), `category`, `read`,
  `rating`.
- **Sort**: `createdAt` (default), `rating`, `name`, `category`.

### `GET /site-feedbacks/unread-count`

Answers `{ "unread": number }` for the panel badge.

### `GET /site-feedbacks/:id` · `PUT /site-feedbacks/:id` · `DELETE /site-feedbacks/:id`

Admin only. `PUT` accepts `rating`, `comment` and `category`, all optional.

### `PATCH /site-feedbacks/:id/read` · `PATCH /site-feedbacks/:id/unread`

Marks the review read or unread. Both answer the updated review.

### SiteFeedbackResponseDto

```typescript
{
  id: string;
  name: string;
  email: string | null;         // null on reviews left before the route required login
  rating: number;
  comment: string;
  category: FeedbackCategory;
  read: boolean;
  createdAt: string;            // ISO
  updatedAt: string;            // ISO
}
```

---

## 2. Comments

**Base URL**: `/comments`

A testimonial left about a Clubinho, shown on the home page once published.

### `POST /comments`

- **Access**: any authenticated user.
- Comments are born **unpublished**; publishing is an administrative act.

```typescript
{
  name: string;                 // max 100
  comment: string;              // max 2000
  clubinho: string;             // max 100
  neighborhood: string;         // max 100
}
```

### `GET /comments/published`

- **Access**: public. Used by the home page and the teacher area.
- Answers a plain array of published comments, newest first.

### `GET /comments`

- **Access**: admin only.
- **Filters**: `searchString` (name, clubinho, neighborhood, text), `published`.
- **Sort**: `createdAt` (default), `name`, `clubinho`.

### `GET /comments/unpublished-count`

Answers `{ "unpublished": number }` for the panel badge.

### `PUT /comments/:id`

Admin only. **Every field is optional** — you change only what changed, and
`published` is not part of it.

Previously the four text fields were required and `published` was validated as
a string, so both publishing and editing a comment answered `400`.

### `PATCH /comments/:id/publish` · `PATCH /comments/:id/unpublish`

Publishes or unpublishes without resending the comment. This is the only way
publication changes.

### `DELETE /comments/:id`

Admin only.

### CommentResponseDto

```typescript
{
  id: string;
  name: string;
  comment: string;
  clubinho: string;
  neighborhood: string;
  published: boolean;
  createdAt: string;            // ISO
  updatedAt: string;            // ISO
}
```

---

## 3. Contacts

**Base URL**: `/contact` (singular)

A message from the public contact form.

### `POST /contact`

- **Access**: public.
- Saving the message notifies the team; a failed notification never loses the
  message.

```typescript
{
  name: string;                 // 2–120
  email: string;                // valid e-mail, max 180
  phone: string;                // 8–20
  message: string;              // 10–2000
}
```

### `GET /contact`

- **Access**: admin only.
- **Filters**: `searchString` (name, e-mail, phone, message), `read`.
- **Sort**: `createdAt` (default), `name`, `email`.

### `GET /contact/unread-count`

Answers `{ "unread": number }` for the panel badge.

### `GET /contact/:id` · `DELETE /contact/:id`

Admin only.

### `PATCH /contact/:id/read` · `PATCH /contact/:id/unread`

Marks the message read or unread. Both answer the updated message.

### ContactResponseDto

```typescript
{
  id: string;
  name: string;
  email: string;
  phone: string;
  message: string;
  read: boolean;
  createdAt: string;            // ISO
  updatedAt: string;            // ISO
}
```

This DTO exists because the route used to answer the raw `ContactEntity`: any
column added to the table would have leaked on its own. The frontend mirrors it
in `src/features/contacts/types.ts`, and `mappers.spec.ts` locks the exact key
set on this side.

---
⬅️ [Back to Documentation Hub](README.md)
