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

"Pagela" is the core record for a child's weekly activity (Attendance, Bible Verse, Meditation).

### Key Rules

- Must be linked to a valid **Academic Week**.
- Child must be **Active**.

### Endpoints

#### `GET /pagelas/paginated`

Powerful search endpoint for pagelas.

- **See**: [Dashboard Endpoints Documentation](api-dashboard-endpoints.md) for full details.

#### `POST /pagelas`

Create/Submit a pagela for a child.

- **Body**:

  ```json
  {
    "childId": "uuid...",
    "year": 2025,
    "week": 12,
    "present": true,
    "didMeditation": false,
    "recitedVerse": true
  }
  ```

#### `PUT /pagelas/:id`

Correct an existing pagela.

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
