# Education & Spirituality API Documentation

This documentation covers the core educational and spiritual tracking features of the system.

## 📋 Index

1. [Club Control (Academic Year)](#1-club-control)
2. [Pagelas (Attendance)](#2-pagelas-attendance)
3. [Accepted Christs](#3-accepted-christs)

---

## 1. Club Control

**Base URL**: `/club-control`

Manages the academic calendar, periods, and global control rules.

### Endpoints

#### `POST /club-control/periods`

Create a new academic period.

- **Body**:

  ```json
  {
    "year": 2025,
    "startDate": "2025-02-01",
    "endDate": "2025-11-30"
  }
  ```

#### `GET /club-control/check/week`

Checks the current status of the requested week (or current week if not specified).

- **Query**: `year`, `week`
- **Returns**: List of clubs and their submission status (OK, MISSING, etc.).

#### `GET /club-control/dashboard`

Aggregated metrics for the main dashboard.

Every endpoint above requires the `admin` role — `ClubControlController` guards
the whole class with `AdminRoleGuard`.

### `GET /club-control/weekly-summary`

The whole academic period seen from above: one row per academic week, one cell
per club. It is the screen the Monday coordinator e-mail links to — the e-mail
reports the week that closed, this answers "and the weeks before it?".

- **Roles**: the transport guard is `AdminOrLeaderRoleGuard` — it lives in its
  own controller because the class-level guard of `ClubControlController` is
  admin-only and method guards add to it, never replace it. The **audience** is
  the flag's, and the flag targets `coordinator` only.
- **Feature flag**: `club_weekly_summary`, checked against the caller's role.
  Out of the flag's audience answers `403 PERM_3003`, so today an `admin` call
  is refused: the admin already has `/statistics`, which covers the whole base
  in far more detail. Widening it is a change of `targetRoles` in the panel,
  not a code change.
- **Scope**: the clubs the caller already sees, resolved through
  `GetClubsService.findAllSimple` — a coordinator gets their own clubs, an
  admin gets every club. No id from the client widens that.
- **Query**: `year` (defaults to the current academic year) and `clubId`
  (narrows the set the session already sees; a club outside it answers `404`,
  never an empty list).
- **Cost**: three queries for the entire period — children, pagelas and
  calendar exceptions — instead of the four-per-club-per-week that
  `ClubWeekCheckService.checkClubWeek` costs.

Response, abbreviated:

```json
{
  "year": 2026,
  "availableYears": [2026, 2025],
  "currentWeek": 12,
  "period": { "year": 2026, "startDate": "2026-03-02", "endDate": "2026-11-28", "totalWeeks": 40 },
  "clubs": [{ "clubId": "…", "clubNumber": 12, "weekday": "wednesday", "isActive": true }],
  "weeks": [
    {
      "week": 1,
      "startDate": "2026-03-02",
      "endDate": "2026-03-07",
      "timeline": "past",
      "counts": { "children": 10, "childrenWithPagela": 7, "childrenMissing": 3, "childrenPresent": 7, "completionRate": 70 },
      "statusCounts": { "ok": 0, "partial": 1, "missing": 0, "pending": 0, "exception": 0, "inactive": 0, "outOfPeriod": 0 },
      "clubs": [
        {
          "clubId": "…",
          "clubNumber": 12,
          "status": "partial",
          "expectedDate": "2026-03-04",
          "exceptionReason": null,
          "counts": { "children": 10, "childrenWithPagela": 7, "childrenMissing": 3, "childrenPresent": 7, "completionRate": 70 }
        }
      ]
    }
  ],
  "highlights": { "weeksElapsed": 12, "counts": { "…": 0 }, "bestWeek": 3, "worstWeek": 9, "weeksWithPendency": 4 }
}
```

Rules the payload encodes:

- `status` is the same seven-value enum the control panel uses, produced by the
  same `ClubStatusService.determineStatus`.
- A child only counts on a week whose expected date is on or after `joinedAt`;
  a child who left counts on no week at all.
- A deactivated club reports zeroed counts: charging a pagela to a club that
  does not meet would invent a shortfall nobody can clear.
- `highlights` covers only the weeks already elapsed. Future weeks start with
  no pagela, and including them would make March look like a year behind.
- A year with no registered period answers `200` with `period: null` and an
  empty `weeks` list — it is a calendar that was never filled in, not an error.

---

## 2. Pagelas (Attendance)

**Base URL**: `/pagelas`
**Authentication**: Required (JWT)

"Pagela" is the core record for a child's weekly activity (attendance, Bible
verse, meditation). One pagela per child per week of a year — the database
enforces it, and a repeat answers `409` with `RESOURCE_ALREADY_EXISTS`.

### Who sees what

Every endpoint is scoped by the caller's role. The scope is applied in the
repository, so it holds for reads and writes alike:

| Role | Scope |
| --- | --- |
| `admin` | Every pagela. |
| `coordinator` | Pagelas of children in the clubs they coordinate. |
| `teacher` | Pagelas of children in the club where they teach. |
| anything else | Nothing — `403 PERM_3001`. |

A pagela outside the caller's scope answers `404`, not `403`: it must not be
possible to learn that someone else's record exists. Writing a pagela for a
child outside the scope answers `403 CHILD_7002`.

### Week and year

`week` and `year` are the **academic** week, counted from the start of the
registered period (`/club-control` periods), not the ISO week.

- Send both and they are used as given.
- Send neither, or only one, and the missing part is derived from the period
  that covers `referenceDate`. The period may be registered under the previous
  or the next year, so all three are consulted.
- No period for that date: `404 RESOURCE_NOT_FOUND`.
- Date outside the period: `422 VAL_4005` on create; on update, week and year
  are simply left as they were.

### Endpoints

#### `GET /pagelas/paginated`

Paginated list.

**Query parameters:**

```typescript
{
  page?: number;              // Default: 1
  limit?: number;             // Default: 20, max: 200
  childId?: string;           // UUID
  year?: number;              // 2000–9999
  week?: number;              // 1–53
  present?: boolean;          // "true" / "false" in the query string
  didMeditation?: boolean;
  recitedVerse?: boolean;
  searchString?: string;      // "2026-48", "2026" or "48"
}
```

**Response:** `Paginated<PagelaResponseDto>` — the shared envelope
(`data`, `total`, `page`, `limit`, `pageCount`).

#### `GET /pagelas`

Same filters, no pagination. Still scoped by role.

#### `GET /pagelas/:id`

One pagela, if it is within the caller's scope.

#### `POST /pagelas`

**Body:**

```typescript
{
  childId: string;              // UUID, required
  referenceDate: string;        // YYYY-MM-DD, required
  present: boolean;             // required
  didMeditation: boolean;       // required
  recitedVerse: boolean;        // required
  week?: number;                // 1–53; derived when absent
  year?: number;                // 2000–9999; derived when absent
  teacherProfileId?: string;    // UUID
  notes?: string;               // max 500 chars
}
```

**Response:** `PagelaResponseDto`

#### `PATCH /pagelas/:id`

Every field optional. `null` clears: `notes: null` empties the note,
`teacherProfileId: null` unlinks the teacher who recorded it.

**Response:** `PagelaResponseDto`

#### `DELETE /pagelas/:id`

**Response:** `{ message: "Pagela removida com sucesso" }`

### PagelaResponseDto

```typescript
{
  id: string;
  childId: string;
  teacherProfileId: string | null;
  referenceDate: string;        // YYYY-MM-DD
  year: number;
  week: number;
  present: boolean;
  didMeditation: boolean;
  recitedVerse: boolean;
  notes: string | null;
  createdAt: string;            // ISO
  updatedAt: string;            // ISO
}
```

The frontend mirrors this in `src/features/pagelas/types.ts`, and
`mappers.spec.ts` locks the exact key set on this side.

---

## 3. Accepted Christs

**Base URL**: `/accepted-christs`

Tracks the spiritual decision of children accepting Christ.

### Endpoints

#### `POST /accepted-christs`

Register a decision.

- **Body**:

  ```json
  {
    "childId": "uuid...",
    "date": "2025-05-20",
    "decisionType": "FIRST_TIME", // or RECONCILIATION
    "notes": "Prayed with teacher X"
  }
  ```

#### `GET /accepted-christs`

List decisions.

- **Filters**: by `childId`, `date`, `club`.

---
⬅️ [Back to Documentation Hub](README.md)
