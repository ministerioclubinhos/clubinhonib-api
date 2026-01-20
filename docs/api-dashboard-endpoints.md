# Dashboard Endpoints Documentation

This documentation describes the 3 main endpoints used in the dashboard for managing clubs, children, and report cards (pagelas).

---

## 📋 Index

1. [GET /clubs - List Clubs](#1-get-clubs---list-clubs)
2. [GET /children - List Children](#2-get-children---list-children)
3. [GET /pagelas/paginated - List Pagelas](#3-get-pagelaspaginated---list-pagelas)

---

## 1. GET /clubs - List Clubs

**Endpoint:** `GET /clubs`

**Description:** Returns a paginated list of clubs with search by address (district, city) and club number.

**Authentication:** Required (JWT Token)

**Permissions:** Admin or Coordinator (Teachers calculate access)

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|-------------|--------|-----------|
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `10` | Items per page (min: 1) |
| `searchString` | string | No | - | Search by:<br>- **Club number** (if integer, e.g., "82")<br>- **District**<br>- **City** |
| `sort` | string | No | `number` | Sort field:<br>- `number` (default)<br>- `weekday`<br>- `time`<br>- `createdAt`<br>- `updatedAt`<br>- `city`<br>- `state` |
| `order` | string | No | `ASC` | Sort order: `ASC` or `DESC` |

### Request Example

```http
GET /clubs?page=1&limit=12&sort=updatedAt&order=DESC
```

**Search by club number:**

```http
GET /clubs?searchString=82
```

**Search by district:**

```http
GET /clubs?searchString=JORGE TEIXEIRA
```

**Search by city:**

```http
GET /clubs?searchString=Manaus
```

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "170a4ca7-3e4f-45de-b2c7-ee9911cd5c32",
      "number": 82,
      "time": "15:30",
      "isActive": true,
      "weekday": "saturday",
      "address": {
        "id": "fef67a54-5e94-41d8-8738-603b443140ff",
        "street": "R: MALVARISCO",
        "number": "157",
        "district": "JORGE TEIXEIRA",
        "city": "MANAUS",
        "state": "AM",
        "postalCode": "",
        "complement": "NIB BRILHO CELESTE, JOÃO PAULO"
      },
      "coordinator": {
        "id": "748f8a3f-8a2b-45f8-a7c0-893af4a38630",
        "active": true,
        "user": {
          "id": "a27880cf-0c57-4ce6-a7bd-48eec5509c05",
          "name": "Carlos Ramos",
          "email": "coordinator.1764451403563@teste.clubinhonib.com",
          "phone": "41369766470",
          "active": true,
          "completed": true,
          "commonUser": false
        }
      },
      "teachers": [...],
      "createdAt": "2025-09-16T17:19:49.492Z",
      "updatedAt": "2025-11-29T21:23:24.000Z"
    }
  ],
  "total": 127,
  "page": 1,
  "limit": 12,
  "pageCount": 11
}
```

### Response Fields

- **data**: Array of clubs
- **total**: Total clubs found (after filtering)
- **page**: Current page
- **limit**: Items per page
- **pageCount**: Total pages

### Search Behavior

- **If `searchString` is an integer:** Searches by club number **OR** in district/city
- **If `searchString` is text:** Searches only in district and city

---

## 2. GET /children - List Children

**Endpoint:** `GET /children`

**Description:** Returns a paginated list of children with search by child name, guardian name, and guardian phone. When `clubNumber` is used, returns only active children by default.

**Authentication:** Required (JWT Token)

**Permissions:** Admin, Coordinator, or Teacher (with role-based access filter)

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|-------------|--------|-----------|
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `20` | Items per page (min: 1) |
| `searchString` | string | No | - | Search by:<br>- Child name<br>- Guardian name<br>- Guardian phone |
| `clubNumber` | number | No | - | Filter by club number<br>**IMPORTANT:** When used, returns only active children by default |
| `orderBy` | string | No | `name` | Sort field:<br>- `name` (default)<br>- `birthDate`<br>- `joinedAt`<br>- `createdAt` |
| `order` | string | No | `ASC` | Sort order: `ASC` or `DESC` |

### Request Example

```http
GET /children?page=1&limit=12&orderBy=updatedAt&order=DESC&clubNumber=82
```

**Search by child name:**

```http
GET /children?searchString=Thiago
```

**Search by guardian name:**

```http
GET /children?searchString=Rafael
```

**Search by phone:**

```http
GET /children?searchString=11987654321
```

### Success Response (200 OK)

```json
{
  "data": [
    {
      "id": "bb1580e8-437c-477a-a89f-a2993bba144e",
      "name": "Thiago Fernandes",
      "birthDate": "2012-07-19",
      "guardianName": "Rafael Teixeira",
      "gender": "Male",
      "guardianPhone": "11987654321",
      "joinedAt": "2024-01-20",
      "isActive": true,
      "club": {
        "id": "170a4ca7-3e4f-45de-b2c7-ee9911cd5c32",
        "number": 82,
        "weekday": "saturday"
      },
      "address": {...},
      "createdAt": "2024-01-20T10:00:00.000Z",
      "updatedAt": "2024-11-29T21:23:24.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 12,
    "totalItems": 40,
    "totalPages": 4,
    "orderBy": "updatedAt",
    "order": "DESC"
  }
}
```

### Response Fields

- **data**: Array of children
- **meta.page**: Current page
- **meta.limit**: Items per page
- **meta.totalItems**: Total children found (after filtering)
- **meta.totalPages**: Total pages
- **meta.orderBy**: Sort field
- **meta.order**: Sort order

### Special Behavior

**When `clubNumber` is used:**

- If `isActive` is not provided, returns only active children
- If `isActive` is explicitly provided, uses the provided value

---

## 3. GET /pagelas/paginated - List Pagelas

**Endpoint:** `GET /pagelas/paginated`

**Description:** Returns a paginated list of pagelas (attendance records) with search by week and year.

**Authentication:** Required (JWT Token)

**Permissions:** Admin, Coordinator, or Teacher (with role-based access filter)

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|-------------|--------|-----------|
| `page` | number | No | `1` | Page number (min: 1) |
| `limit` | number | No | `20` | Items per page (min: 1, max: 200) |
| `childId` | UUID | No | - | Filter by child ID |
| `searchString` | string | No | - | Search by week and year:<br>- **Year** (e.g., "2025") - number between 2000-9999<br>- **Week** (e.g., "48") - number between 1-53<br>- **Year-Week** (e.g., "2025-48") - format "year-week" |
| `year` | number | No | - | Filter by academic year (min: 2000, max: 9999) |
| `week` | number | No | - | Filter by academic week (min: 1, max: 53) |

### Request Example

**List pagelas for a child:**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&page=1&limit=12
```

**Search by year:**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=2025&page=1&limit=12
```

**Search by week:**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=48&page=1&limit=12
```

**Search by year and week (format "year-week"):**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=2025-48&page=1&limit=12
```

**Use direct year and week filters:**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&year=2025&week=48&page=1&limit=12
```

### Success Response (200 OK)

```json
{
  "items": [
    {
      "id": "abc123...",
      "createdAt": "2025-11-28T10:00:00.000Z",
      "updatedAt": "2025-11-28T10:00:00.000Z",
      "childId": "bf0b0946-adc6-45b9-8c8e-37deec9e6191",
      "teacherProfileId": "def456...",
      "referenceDate": "2025-11-28",
      "year": 2025,
      "week": 48,
      "present": true,
      "didMeditation": true,
      "recitedVerse": true,
      "notes": "Week 48 - Present"
    }
  ],
  "total": 48,
  "page": 1,
  "limit": 12,
  "totalPages": 4
}
```

### Response Fields

- **items**: Array of pagelas
- **total**: Total pagelas found (after filtering)
- **page**: Current page
- **limit**: Items per page
- **totalPages**: Total pages

### Default Sorting

Pagelas are sorted by:

1. **Year** (DESC) - Most recent first
2. **Week** (DESC) - Most recent week first
3. **Child Name** (ASC) - Alphabetical order

### Search Behavior (searchString)

The `searchString` accepts the following formats:

1. **Year only:** `"2025"` → Search by year = 2025
2. **Week only:** `"48"` → Search by week = 48 (if between 1-53)
3. **Year and Week:** `"2025-48"` → Search by year = 2025 **AND** week = 48

**Rules:**

- Numbers between 2000-9999 are interpreted as **year**
- Numbers between 1-53 are interpreted as **week**
- Format `"year-week"` (e.g., "2025-48") searches for both

### Important Observations

- **Week and Year:** Week and year are from the **academic year**, not calendar year
- **childId:** Usually required to list pagelas for a specific child
- **Combined filters:** `searchString`, `year`, and `week` can be used together

---

## 🔐 Authentication

All endpoints require authentication via JWT Token. The token must be sent in the header:

```http
Authorization: Bearer <your-jwt-token>
```

## 📝 Frontend Implementation Notes

### 1. Pagination

All endpoints return pagination information:

- **Clubs:** `page`, `limit`, `total`, `pageCount`
- **Children:** `meta.page`, `meta.limit`, `meta.totalItems`, `meta.totalPages`
- **Pagelas:** `page`, `limit`, `total`, `totalPages`

Use these fields to implement pagination controls.

### 2. Real-time Search

For better UX, implement **debounce** on search (`searchString`) to avoid too many requests while typing.

**Recommendation:** Wait 300-500ms after user stops typing before making request.

### 3. Input Placeholders

- **Clubs:** "Address / club #..." → Search in district, city, and club number
- **Children:** "Search by name, guardian, phone..." → Search in child name, guardian name, guardian phone
- **Pagelas:** "Week and year" → Search in week and year (accepts "2025", "48" or "2025-48")

### 4. Error Handling

- **401 Unauthorized:** Invalid or expired token
- **403 Forbidden:** User has no permission to access resource
- **400 Bad Request:** Invalid parameters
- **404 Not Found:** Resource not found

### 5. Loading States

Implement loading states during requests, especially for:

- Search with `searchString`
- Page change
- Filter application

### 6. Cache

Consider implementing cache for:

- Clubs list (changes rarely)
- Children data (update after create/edit)
- Pagelas (update after create/edit)

---

## 📚 Full Usage Examples

### Complete Flow: Select Club → View Children → View Pagelas

**1. List clubs:**

```http
GET /clubs?page=1&limit=12&sort=updatedAt&order=DESC
```

**2. Search club by number:**

```http
GET /clubs?searchString=82&page=1&limit=12
```

**3. Select club #82 and list children:**

```http
GET /children?page=1&limit=12&orderBy=updatedAt&order=DESC&clubNumber=82
```

**4. Search child by name:**

```http
GET /children?clubNumber=82&searchString=Thiago&page=1&limit=12
```

**5. Select child and list pagelas:**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&page=1&limit=12
```

**6. Filter pagelas by week and year:**

```http
GET /pagelas/paginated?childId=bf0b0946-adc6-45b9-8c8e-37deec9e6191&searchString=2025-48&page=1&limit=12
```

---

## 🆘 Support

For questions or issues, consult the full API documentation or contact the development team.

---
⬅️ [Back to Documentation Hub](README.md)
