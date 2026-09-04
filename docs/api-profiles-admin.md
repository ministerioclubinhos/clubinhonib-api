# Profile Administration API

This module handles the administrative link between **Users** and the **Clubs**
they teach in or coordinate.

> **Note**: For general user profile data (personal data, preferences), see the
> [Profile Module](profile-module.md). For the user account itself, see the
> [User Module](user-module.md).

## 📋 Index

1. [Access policy](#1-access-policy)
2. [Teacher Profiles](#2-teacher-profiles)
3. [Coordinator Profiles](#3-coordinator-profiles)
4. [Relationships and lifecycle](#4-relationships-and-lifecycle)
5. [One rule, three doors](#5-one-rule-three-doors)

---

## 1. Access policy

Both controllers sit behind `JwtAuthGuard` and then apply a role policy of their
own. The policy is declared once per module, in `constants.ts`, and enforced by
the `utils.ts` assertions the services call.

| Capability | Admin | Coordinator | Teacher |
| --- | --- | --- | --- |
| Read teacher profiles | ✅ | ✅ | ❌ |
| Assign / unassign a teacher's club | ✅ | ✅, only for clubs they coordinate | ❌ |
| Read coordinator profiles | ✅ | ✅ | ❌ |
| Assign / unassign / move a coordinator's club | ✅ | ❌ | ❌ |

A denied request returns `403` with `ACCESS_DENIED`; a club outside the caller's
scope returns `403` with `CLUB_ACCESS_DENIED`.

Teachers are excluded from both listings because they expose the e-mail and
phone of every colleague and coordinator in the structure.

---

## 2. Teacher Profiles

**Base URL**: `/teacher-profiles`

A Teacher Profile links a **User** to at most one **Club**. The profile itself is
created and removed by the User module when the account's role changes — there is
no HTTP route for it.

### `GET /teacher-profiles`

Paginated listing.

- **Query** (`TeacherProfilesQueryDto`):

  | Field | Type | Default | Notes |
  | --- | --- | --- | --- |
  | `page` | int ≥ 1 | `1` | |
  | `limit` | int 1–100 | `12` | |
  | `searchString` | string | — | teacher or coordinator name, e-mail, phone |
  | `q` | string | — | historical alias of `searchString` |
  | `active` | boolean | — | |
  | `hasClub` | boolean | — | |
  | `clubNumber` | int ≥ 1 | — | |
  | `sort` | `name` \| `clubNumber` \| `createdAt` \| `updatedAt` | `updatedAt` | |
  | `order` | `asc` \| `desc` | `desc` | |

- **Response** (`PageDto<TeacherResponseDto>`):

  ```json
  {
    "items": [
      {
        "id": "uuid-teacher-profile",
        "active": true,
        "user": {
          "id": "uuid-user",
          "name": "João Lima",
          "email": "joao@example.com",
          "phone": "92999990000",
          "active": true,
          "completed": true,
          "commonUser": false
        },
        "club": {
          "id": "uuid-club",
          "number": 12,
          "weekday": "saturday",
          "coordinator": {
            "id": "uuid-coordinator-profile",
            "active": true,
            "user": { "id": "uuid-user", "name": "Marta Reis", "email": "marta@example.com", "phone": "92999990001", "active": true, "completed": true, "commonUser": false }
          }
        },
        "createdAt": "2026-01-01T00:00:00.000Z",
        "updatedAt": "2026-01-02T00:00:00.000Z"
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 12
  }
  ```

Ordering breaks ties by `teacher.id`, so paging never repeats or skips a row.

### `GET /teacher-profiles/simple`

Teachers in the shape the form selects use.

- **Response**: `TeacherSimpleListDto[]` — `{ teacherProfileId, name, vinculado }`.

### `GET /teacher-profiles/:id`

One teacher profile, in the same shape as a listing item.

### `GET /teacher-profiles/by-club/:clubId`

Every teacher of one club. `404` `CLUB_NOT_FOUND` when the club is outside the
caller's scope — the response never reveals that an out-of-scope club exists.

### `PATCH /teacher-profiles/:teacherId/assign-club`

- **Body**: `{ "clubId": "uuid-club" }`
- **Response**: `{ "message": "Professor vinculado ao clubinho com sucesso" }`

**Moving is allowed here.** A teacher already assigned to another club is moved
in a single transaction — no one else loses anything, because the club is an
attribute of the teacher. The route used to refuse with
`PROFILE_INVALID_OPERATION`, so the screen's "swap club" action could never
succeed.

For a coordinator, **both** clubs must be theirs: the target and the teacher's
current one. Checking only the target would let a coordinator pull a teacher out
of another coordinator's class in one request.

`POST /clubs` and `PATCH /clubs/:id` behave identically — see
[One rule, three doors](#5-one-rule-three-doors).

### `PATCH /teacher-profiles/:teacherId/unassign-club`

- **Body**: `{ "clubId": "uuid-club" }` — optional; without it the teacher's
  current club is used.
- **Response**: `{ "message": "Professor desvinculado do clubinho com sucesso" }`

---

## 3. Coordinator Profiles

**Base URL**: `/coordinator-profiles`

A Coordinator Profile links a **User** to the **Clubs** they coordinate. Like the
teacher profile, it is created and removed by the User module and has no HTTP
route of its own.

### `GET /coordinator-profiles`

Paginated listing.

- **Query** (`CoordinatorProfilesQueryDto`): same shape as the teacher query,
  with `hasClubs` instead of `hasClub` and `sort` restricted to
  `name` \| `createdAt` \| `updatedAt`.

- **Response** (`PageDto<CoordinatorResponseDto>`): each item carries `id`,
  `active`, `user`, `clubs` (each with `id`, `number`, `weekday` and its
  `teachers`), `createdAt` and `updatedAt`.

### `GET /coordinator-profiles/simple`

- **Response**: `CoordinatorSimpleListDto[]` — `{ coordinatorProfileId, name, vinculado }`.

### `GET /coordinator-profiles/:id`

One coordinator profile, in the same shape as a listing item.

### `GET /coordinator-profiles/by-club/:clubId`

The coordinator of one club.

### `PATCH /coordinator-profiles/:coordinatorId/assign-club`

- **Body**: `{ "clubId": "uuid-club" }`
- **Response**: `{ "message": "Clubinho atribuído ao coordenador com sucesso" }`
- **Admin only.**

**Moving is refused here.** A club has one coordinator, so reassigning a club
that already has one would take it from someone else — and that person is not on
screen. The route answers `409` `RESOURCE_CONFLICT` with
`details.currentCoordinatorProfileId`; the deliberate transfer goes through
`move-club`, which names both ends. It used to reassign silently.

### `PATCH /coordinator-profiles/:coordinatorId/unassign-club`

- **Body**: `{ "clubId": "uuid-club" }`
- **Response**: `{ "message": "Clubinho removido do coordenador com sucesso" }`
- **Admin only.**

### `PATCH /coordinator-profiles/:fromCoordinatorId/move-club`

- **Body**: `{ "clubId": "uuid-club", "toCoordinatorProfileId": "uuid-coordinator-profile" }`
- **Response**: `{ "message": "Clubinho movido para o coordenador de destino com sucesso" }`
- **Admin only.**

---

## 4. Relationships and lifecycle

- **User** (1) ↔ (0/1) **TeacherProfile** ↔ (0/1) **Club**
- **User** (1) ↔ (0/1) **CoordinatorProfile** ↔ (N) **Clubs**

The profile follows the account, and the User module owns every transition:

| Change on the account | Effect on the profile | Effect on the club link |
| --- | --- | --- |
| Created as teacher/coordinator | Profile created, `active` mirroring the account | none yet |
| `active` toggled | Profile's `active` follows it | **preserved** |
| Role changed | Old profile deleted, new one created | old link dropped with the old profile |
| Account deleted | Both profiles deleted | links dropped |

Deactivating used to **delete** the profile, and with it the club link: turning
the account back on produced a fresh profile with no club, and nothing said the
link was gone. Creation never behaved that way — it kept the profile of an
inactive account — so the two routines disagreed. Now only a role change or a
deletion removes a profile.

Because a suspended person keeps their profile, the listings no longer filter on
the account's `active`: an admin can still see and manage them, and the `active`
query parameter is what filters. The `simple` option lists still exclude
inactive people — a suspended teacher should not be offered for a new
assignment.


---

## 5. One rule, three doors

The same link can be created from three screens, and they must not disagree:

| Door | Subject | Endpoint |
| --- | --- | --- |
| `/adm/professores` | the teacher | `PATCH /teacher-profiles/:id/assign-club` |
| `/adm/coordenadores` | the coordinator | `PATCH /coordinator-profiles/:id/assign-club` |
| `/adm/clubinhos` (club form) | the club | `POST /clubs`, `PATCH /clubs/:id` |

### Teacher ↔ club

**Assigning moves.** Whichever door is used, a teacher already in another club
is moved. The club form used to refuse instead, so the same choice answered
differently depending on the screen the user happened to open.

For a coordinator, the teacher's **current** club must also be within their
scope — enforced by `assertCanAccessTeacherProfiles` plus the scope check on the
profiles route, and by `assertCanTakeTeachers` on the clubs routes. Without it,
the club form would be the back door for taking a teacher out of another
coordinator's class.

The selector shows where the teacher would come from (`No Clubinho 13 — será
movido`) and disables the ones out of reach, with the reason. It used to hide
them entirely, so there was no way to tell why a teacher was missing from the
list.

### Club ↔ coordinator

**The club side replaces; the person side refuses.** The asymmetry is
deliberate and follows what the user can see:

- In the club form the current coordinator is the field's current value. Changing
  it is an ordinary, visible edit, and the form spells out who loses the club
  (`Substitui Marta Reis na coordenação deste clubinho.`).
- On the coordinator screen you are adding to a list, and the club's current
  coordinator is nowhere on screen. Silently taking it would be a surprise, so
  the API answers `409` and the option is shown disabled with the reason.

Setting a club's coordinator is admin-only in both doors; a coordinator can only
assign themselves or clear the field, and the club form hides the control
entirely for them.

---
⬅️ [Back to Documentation Hub](README.md)