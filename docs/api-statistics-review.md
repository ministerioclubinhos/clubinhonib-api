 Statistics Module - API Documentation

> **Version**: 2.0
> **Last Updated**: 2026-01-20 (All filters implemented)
> **Base Path**: `/statistics`

---

## Table of Contents

1. [Overview](#1-overview)
2. [Module Architecture](#2-module-architecture)
3. [Common Types & Enums](#3-common-types--enums)
4. [Endpoints Reference](#4-endpoints-reference)
   - [Charts & Visualization](#41-charts--visualization)
   - [Overview & Dashboard](#42-overview--dashboard)
   - [Paginated Lists](#43-paginated-lists)
   - [Attendance Analysis](#44-attendance-analysis)
   - [Detailed Views](#45-detailed-views)
   - [Advanced Analytics](#46-advanced-analytics)
5. [Query DTOs Reference](#5-query-dtos-reference)
6. [Response DTOs Reference](#6-response-dtos-reference)
7. [Business Rules](#7-business-rules)
8. [Known Issues & Limitations](#8-known-issues--limitations)

---

## 1. Overview

The Statistics Module provides comprehensive analytics and reporting capabilities for the Clubinho NIB system. It offers 20 endpoints for analyzing:

- **Pagelas** (attendance records): presence, meditation, and verse recitation metrics
- **Children**: demographics, engagement scores, and participation patterns
- **Clubs**: performance metrics, attendance rates, and member distribution
- **Teachers**: effectiveness scores and activity tracking
- **Decisions (Accepted Christs)**: spiritual decisions tracking and conversion analysis

### Endpoint Summary

| Category | Functional | Mock/WIP | Total |
|----------|------------|----------|-------|
| Charts & Visualization | 3 | 0 | 3 |
| Overview & Dashboard | 3 | 0 | 3 |
| Paginated Lists | 3 | 0 | 3 |
| Attendance Analysis | 2 | 0 | 2 |
| Detailed Views | 0 | 4 | 4 |
| Advanced Analytics | 0 | 5 | 5 |
| **Total** | **12** | **9** | **20** |

---

## 2. Module Architecture

### File Structure

```
src/modules/statistics/
├── statistics.controller.ts           # HTTP endpoints (20 routes)
├── statistics.service.ts              # Business logic orchestration
├── statistics.repository.ts           # Data access layer (~2500 lines)
├── statistics.module.ts               # NestJS module configuration
├── services/
│   ├── statistics-filters.service.ts  # Query filter application
│   ├── statistics-period.service.ts   # Academic period calculations
│   └── statistics-calculations.service.ts # Score computations
└── dto/
    ├── pagelas-stats-query.dto.ts
    ├── children-stats-query.dto.ts
    ├── clubs-stats-query.dto.ts
    ├── teachers-stats-query.dto.ts
    ├── accepted-christs-stats-query.dto.ts
    ├── period-filter.dto.ts
    ├── pagelas-stats-response.dto.ts
    ├── children-stats-response.dto.ts
    ├── clubs-stats-response.dto.ts
    ├── teachers-stats-response.dto.ts
    ├── accepted-christs-stats-response.dto.ts
    ├── overview-stats-response.dto.ts
    ├── chart-data-response.dto.ts
    └── club-attendance-analysis.dto.ts
```

### Request Flow

```
HTTP Request
    ↓
Controller (validation, logging)
    ↓
Service (business logic, aggregation)
    ↓
Repository (database queries)
    ↓
Filters Service (applies query filters)
    ↓
Period Service (academic period calculations)
    ↓
Calculations Service (scores, rates)
    ↓
Response DTO
```

---

## 3. Common Types & Enums

### PeriodShortcut

Used for quick period selection in queries.

```typescript
enum PeriodShortcut {
  TODAY = 'today',
  THIS_WEEK = 'this_week',
  THIS_MONTH = 'this_month',
  LAST_7_DAYS = 'last_7_days',
  LAST_30_DAYS = 'last_30_days',
  THIS_YEAR = 'this_year',
  CUSTOM = 'custom'
}
```

### GroupBy Options

```typescript
type GroupBy = 'day' | 'week' | 'month' | 'year';
```

### DecisionType

```typescript
enum DecisionType {
  ACCEPTED = 'accepted',
  RECONCILED = 'reconciled'
}
```

### Common Pagination Response

```typescript
interface PaginationResponse {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}
```

---

## 4. Endpoints Reference

### 4.1 Charts & Visualization

#### GET `/statistics/pagelas/charts`

Returns chart-ready data for pagelas visualization.

**Status**: Functional

**Query Parameters**: [PagelasStatsQueryDto](#pagelasstatsquerydto)

**Response**: [PagelasChartDataDto](#pagelaschartdatadto)

**Example Request**:

```http
GET /statistics/pagelas/charts?startDate=2025-01-01&endDate=2025-12-31&groupBy=month
```

**Example Response**:

```json
{
  "timeSeries": {
    "presence": [
      { "date": "2025-01", "value": 85.5, "label": "January" }
    ],
    "meditation": [...],
    "verseRecitation": [...],
    "total": [...]
  },
  "byGender": [
    { "gender": "M", "total": 1500, "presenceRate": 87.2, "meditationRate": 72.1, "verseRecitationRate": 65.3 }
  ],
  "byAgeGroup": [...],
  "byClub": [...],
  "byCity": [...]
}
```

---

#### GET `/statistics/accepted-christs/charts`

Returns chart-ready data for spiritual decisions visualization.

**Status**: Functional

**Query Parameters**: [AcceptedChristsStatsQueryDto](#acceptedchristsstatsquerydto)

**Response**: [AcceptedChristsChartDataDto](#acceptedchristschartdatadto)

**Example Request**:

```http
GET /statistics/accepted-christs/charts?startDate=2025-01-01&endDate=2025-06-30&groupBy=month
```

**Example Response**:

```json
{
  "timeSeries": [
    { "date": "2025-01", "series": { "accepted": 15, "reconciled": 8 } }
  ],
  "byGender": [
    { "gender": "M", "total": 45, "accepted": 30, "reconciled": 15 }
  ],
  "byAgeGroup": [...],
  "conversionFunnel": {
    "totalChildren": 1000,
    "childrenWithPagelas": 850,
    "childrenWithDecisions": 120,
    "childrenAccepted": 80,
    "childrenReconciled": 40,
    "conversionRate": 12.0
  }
}
```

---

#### GET `/statistics/insights`

Returns combined insights from pagelas and decisions data.

**Status**: Functional

**Query Parameters**: Mixed - supports prefixed filters:

- `pagelas_*` - Applied to pagelas queries
- `ac_*` - Applied to accepted christs queries
- Unprefixed - Applied to both

**Response**: [CombinedInsightsDto](#combinedinsightsdto)

**Example Request**:

```http
GET /statistics/insights?clubId=abc123&pagelas_minPresenceRate=70
```

**Example Response**:

```json
{
  "topEngagedChildren": [
    {
      "childId": "uuid",
      "childName": "John Doe",
      "gender": "M",
      "age": 8,
      "clubNumber": 42,
      "engagementScore": 95.5,
      "totalPagelas": 45,
      "presenceRate": 98.2,
      "hasDecision": true,
      "decisionType": "accepted"
    }
  ],
  "clubRankings": [...],
  "teacherEffectiveness": [...],
  "trends": [
    { "metric": "presence", "trend": "up", "changePercentage": 5.2 }
  ]
}
```

---

### 4.2 Overview & Dashboard

#### GET `/statistics/overview`

Returns comprehensive dashboard statistics.

**Status**: Functional

**Query Parameters**: None

**Response**: [OverviewStatsResponseDto](#overviewstatsresponsedto)

**Example Response**:

```json
{
  "summary": {
    "totalChildren": 1500,
    "totalClubs": 45,
    "totalTeachers": 120,
    "activeChildrenThisMonth": 1200,
    "activeTeachersThisMonth": 95,
    "inactiveChildren": 300,
    "inactiveClubs": 5
  },
  "pagelas": {
    "thisWeek": {
      "total": 850,
      "presenceRate": 87.5,
      "meditationRate": 72.3,
      "verseRecitationRate": 65.8
    },
    "thisMonth": {...},
    "lastSixWeeks": [...]
  },
  "acceptedChrists": {
    "thisWeek": 5,
    "thisMonth": 18,
    "thisYear": 156,
    "byDecisionType": { "accepted": 100, "reconciled": 56 },
    "lastSixMonths": [...]
  },
  "engagement": {...},
  "indicators": {...},
  "quickStats": {...}
}
```

---

#### GET `/statistics/pagelas`

Returns pagelas statistics with optional filtering.

**Status**: Functional

**Query Parameters**: [PagelasStatsQueryDto](#pagelasstatsquerydto)

**Response**: [PagelasStatsResponseDto](#pagelasstatsresponsedto)

**Example Response**:

```json
{
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "year": 2025
  },
  "overall": {
    "totalPagelas": 25000,
    "totalChildren": 1500,
    "totalTeachers": 120,
    "averagePresenceRate": 85.2,
    "averageMeditationRate": 70.5,
    "averageVerseRecitationRate": 62.3
  },
  "byWeek": [...],
  "topPerformers": [...]
}
```

---

#### GET `/statistics/accepted-christs`

Returns spiritual decisions statistics.

**Status**: Functional

**Query Parameters**: [AcceptedChristsStatsQueryDto](#acceptedchristsstatsquerydto)

**Response**: [AcceptedChristsStatsResponseDto](#acceptedchristsstatsresponsedto)

**Example Response**:

```json
{
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31"
  },
  "overall": {
    "totalDecisions": 156,
    "uniqueChildren": 140,
    "byDecisionType": {
      "accepted": 100,
      "reconciled": 56
    }
  },
  "byPeriod": [...],
  "recentDecisions": [...]
}
```

---

### 4.3 Paginated Lists

#### GET `/statistics/children`

Returns paginated list of children with their statistics.

**Status**: Functional

**Query Parameters**: [ChildrenStatsQueryDto](#childrenstatsquerydto)

**Response**: [ChildrenStatsResponseDto](#childrenstatsresponsedto)

**Example Request**:

```http
GET /statistics/children?page=1&limit=20&minEngagementScore=50&sortBy=engagementScore&sortOrder=DESC
```

**Example Response**:

```json
{
  "filters": {
    "applied": { "minEngagementScore": 50 },
    "summary": "Filtering by minimum engagement score: 50"
  },
  "summary": {
    "totalChildren": 1500,
    "filteredChildren": 1200,
    "avgAge": 8.5,
    "avgEngagementScore": 72.3,
    "avgPresenceRate": 85.2,
    "childrenWithDecisions": 120,
    "activeChildren": 1400
  },
  "distribution": {
    "byGender": [...],
    "byAgeGroup": [...],
    "byClub": [...],
    "byCity": [...],
    "byParticipationTime": [...]
  },
  "children": [
    {
      "childId": "uuid",
      "name": "John Doe",
      "gender": "M",
      "age": 8,
      "birthDate": "2017-03-15",
      "joinedAt": "2024-02-01",
      "monthsParticipating": 11,
      "participationTimeRange": "6-12 months",
      "club": { "id": "uuid", "number": 42, "weekday": "Saturday" },
      "address": { "city": "São Paulo", "state": "SP" },
      "stats": {
        "totalPagelas": 45,
        "presenceCount": 42,
        "meditationCount": 38,
        "verseRecitationCount": 35,
        "presenceRate": 93.3,
        "meditationRate": 84.4,
        "verseRecitationRate": 77.8,
        "engagementScore": 85.2,
        "consecutiveWeeks": 12
      },
      "decisions": {
        "hasDecision": true,
        "decisionType": "accepted",
        "decisionDate": "2025-06-15",
        "totalDecisions": 1
      },
      "isActive": true,
      "rank": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1200,
    "totalPages": 60,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

---

#### GET `/statistics/clubs`

Returns paginated list of clubs with their statistics.

**Status**: Functional

**Query Parameters**: [ClubsStatsQueryDto](#clubsstatsquerydto)

**Response**: [ClubsStatsResponseDto](#clubsstatsresponsedto)

**Example Request**:

```http
GET /statistics/clubs?page=1&limit=10&minPerformanceScore=70&sortBy=performanceScore&sortOrder=DESC
```

**Example Response**:

```json
{
  "filters": {
    "applied": { "minPerformanceScore": 70 },
    "summary": "Filtering by minimum performance score: 70"
  },
  "summary": {
    "totalClubs": 45,
    "filteredClubs": 38,
    "totalChildren": 1500,
    "totalTeachers": 120,
    "avgPerformanceScore": 78.5,
    "avgPresenceRate": 85.2,
    "totalDecisions": 156
  },
  "distribution": {
    "byCity": [...],
    "byWeekday": [...],
    "byCoordinator": [...],
    "byPerformance": [...]
  },
  "clubs": [
    {
      "clubId": "uuid",
      "clubNumber": 42,
      "weekday": "Saturday",
      "time": "09:00",
      "address": { "city": "São Paulo", "state": "SP", "district": "Centro" },
      "coordinator": { "id": "uuid", "name": "Jane Doe" },
      "children": {
        "total": 35,
        "active": 32,
        "byGender": { "M": 18, "F": 17 },
        "avgAge": 8.2,
        "withDecisions": 8
      },
      "teachers": {
        "total": 4,
        "active": 4,
        "list": [{ "id": "uuid", "name": "Teacher Name" }]
      },
      "performance": {
        "totalPagelas": 1200,
        "presenceRate": 89.5,
        "meditationRate": 75.2,
        "verseRecitationRate": 68.3,
        "performanceScore": 82.5,
        "totalDecisions": 8
      },
      "lastActivity": { "date": "2025-01-18", "type": "pagela" },
      "rank": 1
    }
  ],
  "pagination": {...},
  "inactiveClubs": { "total": 5, "list": [...] },
  "inactiveChildren": { "total": 300, "fromInactiveClubs": 150 }
}
```

---

#### GET `/statistics/teachers`

Returns paginated list of teachers with their statistics.

**Status**: Functional

**Query Parameters**: [TeachersStatsQueryDto](#teachersstatsquerydto)

**Response**: [TeachersStatsResponseDto](#teachersstatsresponsedto)

**Example Response**:

```json
{
  "filters": {...},
  "summary": {
    "totalTeachers": 120,
    "filteredTeachers": 115,
    "activeTeachers": 95,
    "totalChildren": 1500,
    "avgEffectivenessScore": 75.3,
    "avgPresenceRate": 82.5
  },
  "distribution": {
    "byClub": [...],
    "byCity": [...],
    "byEffectiveness": [...]
  },
  "teachers": [
    {
      "teacherId": "uuid",
      "name": "Teacher Name",
      "club": { "id": "uuid", "number": 42, "weekday": "Saturday", "city": "São Paulo", "state": "SP" },
      "coordinator": { "id": "uuid", "name": "Coordinator Name" },
      "children": {
        "total": 35,
        "unique": 30,
        "active": 28,
        "withDecisions": 5,
        "avgEngagement": 72.5
      },
      "performance": {
        "totalPagelas": 450,
        "avgPresenceRate": 85.2,
        "avgMeditationRate": 70.5,
        "avgVerseRate": 62.3,
        "effectivenessScore": 78.5
      },
      "lastActivity": { "date": "2025-01-18", "totalPagelas": 12 },
      "isActive": true,
      "rank": 1
    }
  ],
  "pagination": {...}
}
```

---

### 4.4 Attendance Analysis

#### GET `/statistics/attendance/club/:clubId`

Analyzes attendance patterns for a specific club, identifying missing weeks.

**Status**: Functional

**Path Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clubId` | string (UUID) | Yes | Club identifier |

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year` | number | Yes | Academic year (2020-2100) |
| `startDate` | string | No | Start date (YYYY-MM-DD) |
| `endDate` | string | No | End date (YYYY-MM-DD) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50) |

**Response**: [ClubAttendanceAnalysisDto](#clubattendanceanalysisdto)

**Example Request**:

```http
GET /statistics/attendance/club/abc123?year=2025
```

**Example Response**:

```json
{
  "clubId": "abc123",
  "clubNumber": 42,
  "weekday": "Saturday",
  "period": {
    "startDate": "2025-01-01",
    "endDate": "2025-12-31",
    "totalWeeks": 52,
    "activeWeeks": 48
  },
  "attendance": {
    "weeksWithPagela": 45,
    "weeksExpected": 48,
    "weeksMissing": 3,
    "attendanceRate": 93.75,
    "consecutiveWeeksPresent": 12,
    "consecutiveWeeksMissing": 0
  },
  "missingWeeks": [
    {
      "year": 2025,
      "week": 15,
      "expectedDate": "2025-04-12",
      "weekRange": { "start": "2025-04-07", "end": "2025-04-13" },
      "reason": "no_pagela",
      "severity": "warning"
    }
  ],
  "alerts": [
    {
      "type": "missing_weeks",
      "severity": "warning",
      "message": "3 weeks without pagela records",
      "weeksMissing": 3
    }
  ],
  "timeline": [
    {
      "year": 2025,
      "week": 1,
      "date": "2025-01-04",
      "hasPagela": true,
      "totalPagelas": 32,
      "presenceRate": 88.5
    }
  ]
}
```

---

#### GET `/statistics/attendance/week`

Returns attendance status for all clubs in a specific week.

**Status**: Functional

**Query Parameters**:

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `year` | number | Yes | Academic year (2020-2100) |
| `week` | number | Yes | Academic week (1-53) |
| `page` | number | No | Page number (default: 1) |
| `limit` | number | No | Items per page (default: 50) |

**Response**: [WeeklyAttendanceDto](#weeklyattendancedto)

**Example Request**:

```http
GET /statistics/attendance/week?year=2025&week=3
```

**Example Response**:

```json
{
  "year": 2025,
  "week": 3,
  "weekRange": {
    "start": "2025-01-13",
    "end": "2025-01-19"
  },
  "clubs": [
    {
      "clubId": "uuid",
      "clubNumber": 42,
      "weekday": "Saturday",
      "hasPagela": true,
      "totalPagelas": 32,
      "expectedDate": "2025-01-18",
      "status": "ok"
    },
    {
      "clubId": "uuid2",
      "clubNumber": 15,
      "weekday": "Saturday",
      "hasPagela": false,
      "expectedDate": "2025-01-18",
      "status": "missing"
    }
  ],
  "summary": {
    "totalClubs": 45,
    "clubsActive": 43,
    "clubsWithPagela": 40,
    "clubsMissing": 3,
    "attendanceRate": 93.02
  },
  "pagination": {...}
}
```

---

### 4.5 Detailed Views

> **Note**: These endpoints are currently returning mock data and are work-in-progress.

#### GET `/statistics/clubs/:clubId`

**Status**: Mock/WIP

Returns detailed statistics for a specific club.

---

#### GET `/statistics/children/:childId`

**Status**: Mock/WIP

Returns detailed statistics for a specific child.

---

#### GET `/statistics/teachers/:teacherId`

**Status**: Mock/WIP

Returns detailed statistics for a specific teacher.

---

#### GET `/statistics/cities/:city`

**Status**: Mock/WIP

Returns statistics distribution for a specific city.

---

### 4.6 Advanced Analytics

> **Note**: These endpoints are currently returning mock data and are work-in-progress.

#### GET `/statistics/compare`

**Status**: Mock/WIP

Compares statistics between multiple entities.

---

#### GET `/statistics/trends`

**Status**: Mock/WIP

Analyzes trends over time periods.

---

#### GET `/statistics/reports/consolidated`

**Status**: Mock/WIP

Generates consolidated reports.

---

#### GET `/statistics/rankings/:type`

**Status**: Mock/WIP

Returns rankings by specified type (children, clubs, teachers).

---

#### GET `/statistics/dashboard/:role`

**Status**: Mock/WIP

Returns personalized dashboard data based on user role.

---

## 5. Query DTOs Reference

### PagelasStatsQueryDto

Used for filtering pagelas-related queries.

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `year` | number | Min: 2020, Max: 2100 | Filter by academic year |
| `week` | number | Min: 1, Max: 53 | Filter by academic week |
| `startDate` | string | Date format | Period start date (YYYY-MM-DD) |
| `endDate` | string | Date format | Period end date (YYYY-MM-DD) |
| `clubId` | string | UUID | Filter by club |
| `teacherId` | string | UUID | Filter by teacher |
| `coordinatorId` | string | UUID | Filter by coordinator |
| `gender` | string | 'M' or 'F' | Filter by gender |
| `minAge` | number | Min: 0, Max: 100 | Minimum age filter |
| `maxAge` | number | Min: 0, Max: 100 | Maximum age filter |
| `city` | string | - | Filter by city |
| `state` | string | - | Filter by state |
| `district` | string | - | Filter by district |
| `joinedAfter` | string | Date format | Joined after date |
| `joinedBefore` | string | Date format | Joined before date |
| `onlyPresent` | boolean | - | Only records where child was present |
| `onlyDidMeditation` | boolean | - | Only records where child did meditation |
| `onlyRecitedVerse` | boolean | - | Only records where child recited verse |
| `groupBy` | enum | 'day', 'week', 'month', 'year' | Time series grouping |

---

### ChildrenStatsQueryDto

Most comprehensive query DTO with 24+ filter options.

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `period` | PeriodShortcut | Enum | Quick period selection |
| `year` | number | Min: 2020, Max: 2100 | Filter by academic year |
| `startDate` | string | Date format | Period start date |
| `endDate` | string | Date format | Period end date |
| `clubId` | string | UUID | Filter by club |
| `teacherId` | string | UUID | Filter by teacher |
| `coordinatorId` | string | UUID | Filter by coordinator |
| `gender` | string | 'M' or 'F' | Filter by gender |
| `minAge` | number | Min: 0, Max: 100 | Minimum age |
| `maxAge` | number | Min: 0, Max: 100 | Maximum age |
| `ageGroup` | string | - | Filter by age group (e.g., "0-5", "6-10") |
| `city` | string | - | Filter by city |
| `state` | string | - | Filter by state |
| `district` | string | - | Filter by district |
| `joinedAfter` | string | Date format | Joined after date |
| `joinedBefore` | string | Date format | Joined before date |
| `minPagelas` | number | Min: 0 | Minimum pagelas count |
| `minPresenceRate` | number | Min: 0, Max: 100 | Minimum presence rate % |
| `maxPresenceRate` | number | Min: 0, Max: 100 | Maximum presence rate % |
| `minEngagementScore` | number | Min: 0, Max: 100 | Minimum engagement score |
| `maxEngagementScore` | number | Min: 0, Max: 100 | Maximum engagement score |
| `hasDecision` | boolean | - | Filter by having spiritual decision |
| `decisionType` | string | DecisionType enum | Filter by decision type |
| `isActive` | boolean | - | Filter by active status |
| `hasLowEngagement` | boolean | - | Filter children with low engagement |
| `isNewcomer` | boolean | - | Filter newcomers (< 3 months) |
| `isVeteran` | boolean | - | Filter veterans (> 12 months) |
| `search` | string | - | Search by name |
| `sortBy` | string | - | Sort field |
| `sortOrder` | string | 'ASC' or 'DESC' | Sort direction |
| `page` | number | Min: 1 | Page number |
| `limit` | number | Min: 1, Max: 100 | Items per page |

---

### ClubsStatsQueryDto

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `period` | PeriodShortcut | Enum | Quick period selection |
| `year` | number | Min: 2020, Max: 2100 | Filter by year |
| `startDate` | string | Date format | Period start date |
| `endDate` | string | Date format | Period end date |
| `coordinatorId` | string | UUID | Filter by coordinator |
| `weekday` | string | - | Filter by meeting day |
| `city` | string | - | Filter by city |
| `state` | string | - | Filter by state |
| `district` | string | - | Filter by district |
| `minChildren` | number | Min: 0 | Minimum children count |
| `maxChildren` | number | Min: 0 | Maximum children count |
| `minPresenceRate` | number | Min: 0, Max: 100 | Minimum presence rate |
| `maxPresenceRate` | number | Min: 0, Max: 100 | Maximum presence rate |
| `minPerformanceScore` | number | Min: 0, Max: 100 | Minimum performance score |
| `maxPerformanceScore` | number | Min: 0, Max: 100 | Maximum performance score |
| `minDecisions` | number | Min: 0 | Minimum decisions count |
| `minTeachers` | number | Min: 0 | Minimum teachers count |
| `sortBy` | string | - | Sort field |
| `sortOrder` | string | 'ASC' or 'DESC' | Sort direction |
| `page` | number | Min: 1 | Page number |
| `limit` | number | Min: 1, Max: 100 | Items per page |

---

### TeachersStatsQueryDto

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `period` | PeriodShortcut | Enum | Quick period selection |
| `year` | number | Min: 2020, Max: 2100 | Filter by year |
| `startDate` | string | Date format | Period start date |
| `endDate` | string | Date format | Period end date |
| `clubId` | string | UUID | Filter by club |
| `coordinatorId` | string | UUID | Filter by coordinator |
| `city` | string | - | Filter by city |
| `state` | string | - | Filter by state |
| `minPagelas` | number | Min: 0 | Minimum pagelas count |
| `minChildren` | number | Min: 0 | Minimum children count |
| `minPresenceRate` | number | Min: 0, Max: 100 | Minimum presence rate |
| `maxPresenceRate` | number | Min: 0, Max: 100 | Maximum presence rate |
| `minEffectivenessScore` | number | Min: 0, Max: 100 | Minimum effectiveness score |
| `maxEffectivenessScore` | number | Min: 0, Max: 100 | Maximum effectiveness score |
| `minDecisions` | number | Min: 0 | Minimum decisions count |
| `isActive` | boolean | - | Filter by active status |
| `search` | string | - | Search by name |
| `sortBy` | string | - | Sort field |
| `sortOrder` | string | 'ASC' or 'DESC' | Sort direction |
| `page` | number | Min: 1 | Page number |
| `limit` | number | Min: 1, Max: 100 | Items per page |

---

### AcceptedChristsStatsQueryDto

| Field | Type | Validation | Description |
|-------|------|------------|-------------|
| `startDate` | string | Date format | Period start date |
| `endDate` | string | Date format | Period end date |
| `clubId` | string | UUID | Filter by club |
| `coordinatorId` | string | UUID | Filter by coordinator |
| `decision` | DecisionType | Enum | Filter by decision type |
| `gender` | string | 'M' or 'F' | Filter by gender |
| `minAge` | number | Min: 0, Max: 100 | Minimum age |
| `maxAge` | number | Min: 0, Max: 100 | Maximum age |
| `city` | string | - | Filter by city |
| `state` | string | - | Filter by state |
| `district` | string | - | Filter by district |
| `joinedAfter` | string | Date format | Joined after date |
| `joinedBefore` | string | Date format | Joined before date |
| `groupBy` | enum | 'day', 'week', 'month', 'year' | Time series grouping |

---

## 6. Response DTOs Reference

### OverviewStatsResponseDto

```typescript
{
  summary: {
    totalChildren: number;
    totalClubs: number;
    totalTeachers: number;
    activeChildrenThisMonth: number;
    activeTeachersThisMonth: number;
    inactiveChildren: number;
    inactiveClubs: number;
  };
  pagelas: {
    thisWeek: {
      total: number;
      presenceRate: number;
      meditationRate: number;
      verseRecitationRate: number;
    };
    thisMonth: {...};
    lastSixWeeks: Array<{
      week: number;
      year: number;
      total: number;
      presenceRate: number;
    }>;
  };
  acceptedChrists: {
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    byDecisionType: Record<string, number>;
    lastSixMonths: Array<{ month: string; total: number }>;
  };
  engagement?: {...};
  indicators?: {...};
  quickStats?: {...};
}
```

### PagelasChartDataDto

```typescript
{
  timeSeries?: {
    presence: TimeSeriesDataPoint[];
    meditation: TimeSeriesDataPoint[];
    verseRecitation: TimeSeriesDataPoint[];
    total: TimeSeriesDataPoint[];
  };
  byGender?: Array<{
    gender: string;
    total: number;
    presenceRate: number;
    meditationRate: number;
    verseRecitationRate: number;
  }>;
  byAgeGroup?: Array<{...}>;
  byClub?: Array<{...}>;
  byTeacher?: Array<{...}>;
  byCity?: Array<{...}>;
  byParticipationTime?: Array<{...}>;
  activityHeatmap?: Array<{
    week: number;
    year: number;
    present: number;
    meditation: number;
    verse: number;
  }>;
  comparison?: {
    current: {...};
    previous: {...};
    change: {...};
  };
}
```

### ClubAttendanceAnalysisDto

```typescript
{
  clubId: string;
  clubNumber: number;
  weekday: string;
  period: {
    startDate: string;
    endDate: string;
    totalWeeks: number;
    activeWeeks: number;
  };
  attendance: {
    weeksWithPagela: number;
    weeksExpected: number;
    weeksMissing: number;
    attendanceRate: number;
    consecutiveWeeksPresent: number;
    consecutiveWeeksMissing: number;
  };
  missingWeeks: MissingWeekDto[];
  alerts: Array<{
    type: 'missing_weeks' | 'low_attendance' | 'inactive' | 'consecutive_missing';
    severity: 'critical' | 'warning' | 'info';
    message: string;
    weeksMissing?: number;
    lastPagelaDate?: string;
  }>;
  timeline: Array<{
    year: number;
    week: number;
    date: string;
    hasPagela: boolean;
    totalPagelas?: number;
    presenceRate?: number;
  }>;
}
```

---

## 7. Business Rules

### 7.1 Core Rules

| # | Rule | Description | Impact |
|---|------|-------------|--------|
| 1 | **Active Children Only** | Only children with `isActive = true` are counted | High |
| 2 | **Join Date Respect** | Respect `joinedAt` - weeks before joining are not counted | High |
| 3 | **Academic Period** | Return empty arrays when no active academic period | Medium |
| 4 | **Academic Week** | Use academic year week calculation (not ISO week) | High |
| 5 | **Max Week Filter** | Ignore pagelas with `week > maxAcademicWeek` | Medium |

### 7.2 Calculation Formulas

#### Engagement Score

```
engagementScore = (presenceCount * 0.30 + meditationCount * 0.35 + verseCount * 0.35) * 100 / totalPagelas
```

#### Performance Score (Clubs)

```
performanceScore = presenceRate * 0.30 + meditationRate * 0.30 + activityRate * 0.20 + decisionRate * 0.20
```

#### Effectiveness Score (Teachers)

```
effectivenessScore = avgPresenceRate * 0.30 + avgMeditationRate * 0.30 + avgVerseRate * 0.20 + decisionsPerChild * 0.20
```

### 7.3 Compliance Status by Endpoint

| Endpoint | isActive | joinedAt | Period | Week | maxWeek |
|----------|----------|----------|--------|------|---------|
| `/attendance/club/:clubId` | Yes | Yes | Yes | Yes | Yes |
| `/attendance/week` | Yes | Yes | Yes | Yes | Yes |
| `/children` | Yes | Yes | Partial | Partial | Partial |
| `/clubs` | Yes | Partial | Partial | Partial | Partial |
| `/teachers` | Yes | Partial | Partial | Partial | Partial |
| `/pagelas/charts` | Yes | - | Partial | Partial | - |
| `/accepted-christs/charts` | Yes | - | Partial | - | - |

---

## 8. Known Issues & Limitations

### 8.1 Critical Issues

#### Hardcoded Dates

**Location**: `statistics-filters.service.ts`, lines 19-21

```typescript
// ISSUE: Hardcoded for 2025
const periodStartDate = '2025-01-01';
const periodEndDate = '2025-12-31';
const periodYear = 2025;
```

**Impact**: Queries from 2026 onwards will use incorrect academic period calculations.

**Recommended Fix**: Use dynamic academic period from `PeriodService`.

---

### 8.2 Performance Issues

| Issue | Location | Impact | Recommendation |
|-------|----------|--------|----------------|
| No caching | `getOverviewStatistics` | 18 queries per request | Implement cache with 5-15 min TTL |
| In-memory processing | `getPagelasByAgeGroup` | Memory issues at scale | Use SQL GROUP BY |
| N+1 queries | `getClubsWithStats` | 7 queries per request | Consolidate with JOINs |

### 8.3 Scalability Estimates

| Volume | Performance | Risk Level |
|--------|-------------|------------|
| 1,000 children | Good | Low |
| 10,000 children | Slow without cache | Medium |
| 100,000 children | Possible OOM | High |
| 1,000,000+ pagelas/month | Analysis > 30s | Critical |

---

## Revision History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-20 | 2.0 | Complete rewrite with full endpoint and DTO documentation |
| - | 1.0 | Initial checklist version |

---

[Back to Documentation Hub](README.md)