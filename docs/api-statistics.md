# Statistics API Documentation

The **Statistics Module** is the analytics engine of Clubinho NIB, providing insights into attendance, growth, and team performance.

**Base URL**: `/statistics`

## 📋 Index

1. [Dashboard & Overviews](#1-dashboard--overviews)
2. [Attendance Metrics](#2-attendance-metrics)
3. [Growth & Children](#3-growth--children)
4. [Rankings & Reports](#4-rankings--reports)

---

## 1. Dashboard & Overviews

### `GET /statistics/overview`

**The Main Admin Dashboard.**
Returns high-level metrics:

- Total Active Clubs
- Total Active Children
- Attendance Rate (Last Week)
- Decisions for Christ (YTD)

### `GET /statistics/dashboard/:role`

Personalized dashboard data based on the user's role (Coordinator, Teacher).

### `GET /statistics/insights`

AI or heuristic-based insights (e.g., "Club X is trending down", "Attendance dropped 10%").

---

## 2. Attendance Metrics

### `GET /statistics/attendance/week`

Weekly attendance summary.

- **Query**: `year`, `week`

### `GET /statistics/attendance/club/:clubId`

Detailed attendance history for a specific club.

### `GET /statistics/pagelas/charts`

Data formatted for frontend chart libraries (Line/Bar charts) showing attendance trends over time.

---

## 3. Growth & Children

### `GET /statistics/children`

Demographic stats:

- Age distribution
- Gender split
- Active vs Inactive ratio

### `GET /statistics/accepted-christs`

Stats on spiritual decisions.

### `GET /statistics/accepted-christs/charts`

Chart data for decisions over time.

---

## 4. Rankings & Reports

### `GET /statistics/rankings/:type`

- **Types**: `attendance`, `growth`, `decisions`.
- **Returns**: Ordered list of top performing clubs.

### `GET /statistics/reports/consolidated`

Downloadable or JSON consolidated report for the Academic Period.

---
⬅️ [Back to Documentation Hub](README.md)
