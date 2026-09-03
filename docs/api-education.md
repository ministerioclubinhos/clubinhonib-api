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
