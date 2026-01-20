# Profile Module Documentation

The **Profile Module** handles the extended profile information, specifically **Personal Data** (demographics) and **User Preferences** (traits, favorites).

**Base URL**: `/profiles`

---

## 1. Create Complete Profile

Creates a full profile record, populating personal data and preferences in one go.

- **Endpoint**: `POST /profiles`
- **Access**: Protected (`JwtAuthGuard`)

### Request Body (`CreateCompleteProfileDto`)

The body contains two main nested objects: `personalData` and `preferences`.

#### Nested: `personalData` (`CreatePersonalDataDto`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `birthDate` | `string` (ISO) | No | Date of birth (YYYY-MM-DD). |
| `gender` | `string` | No | e.g., "Male", "Female". |
| `gaLeaderName` | `string` | No | Name of GA Leader. |
| `gaLeaderContact` | `string` | No | Contact info for GA Leader. |

#### Nested: `preferences` (`CreateUserPreferencesDto`)

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `loveLanguages` | `string` | No | e.g., "Words of Affirmation". |
| `temperaments` | `string` | No | e.g., "Sanguine". |
| `favoriteColor` | `string` | No | e.g., "Blue". |
| `favoriteFood` | `string` | No | e.g., "Pizza". |
| `favoriteMusic` | `string` | No | e.g., "Gospel". |
| `skillsAndTalents` | `string` | No | Free text. |
| `whatMakesYouSmile` | `string` | No | Free text. |

#### Example Request JSON

```json
{
  "personalData": {
    "birthDate": "1990-05-15",
    "gender": "Female",
    "gaLeaderName": "Pastor John",
    "gaLeaderContact": "(11) 99999-1234"
  },
  "preferences": {
    "loveLanguages": "Quality Time",
    "temperaments": "Phlegmatic",
    "favoriteColor": "Yellow",
    "favoriteFood": "Lasagna",
    "skillsAndTalents": "Singing, Teaching"
  }
}
```

### Response (`CompleteProfileResponseDto`)

- **Status**: `201 Created`

#### Example Response JSON

```json
{
  "id": "user-uuid-123",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "phone": "5511999998888",
  "role": "teacher",
  "personalData": {
    "birthDate": "1990-05-15",
    "gender": "Female",
    "gaLeaderName": "Pastor John",
    "gaLeaderContact": "(11) 99999-1234"
  },
  "preferences": {
    "loveLanguages": "Quality Time",
    "temperaments": "Phlegmatic",
    "favoriteColor": "Yellow"
  }
}
```

---

## 2. List Profiles (Admin/Coordinator)

Retrieves a paginated list of extended profiles.

- **Endpoint**: `GET /profiles`
- **Access**: Protected (Admin, Coordinator)

### Query Parameters (`QueryProfilesDto`)

| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `int` | `1` | Page number. |
| `limit` | `int` | `10` | Items per page. |
| `q` | `string` | - | General search. |
| `name` | `string` | - | Filter by name. |
| `role` | `string` | - | Filter by role. |
| `loveLanguages` | `string` | - | Filter by specific preference. |
| `sortBy` | `enum` | `name` | `name`, `email`, `createdAt`. |

#### Example Request URL

`GET /profiles?page=1&limit=20&role=teacher&loveLanguages=Quality%20Time`

### Response

- **Status**: `200 OK`
- Returns paginated list of `CompleteProfileResponseDto`.

---

## 3. Get My Profile

Retrieves the authenticated user's complete profile.

- **Endpoint**: `GET /profiles/me`
- **Access**: Protected (`JwtAuthGuard`)

### Response

- **Status**: `200 OK`
- Returns `CompleteProfileResponseDto` (see Example in Create).

---

## 4. Update My Profile

Updates the authenticated user's extended profile data.

- **Endpoint**: `PUT /profiles/me`
- **Access**: Protected (`JwtAuthGuard`)

### Request Body (`UpdateCompleteProfileDto`)

- Same structure as Create, but all fields are optional. Supports partial updates.

#### Example Request JSON

```json
{
  "preferences": {
    "favoriteColor": "Green"
  }
}
```

*In this example, only `favoriteColor` is updated; other fields remain unchanged.*

### Response

- **Status**: `200 OK`
- Returns updated `CompleteProfileResponseDto`.

---

## 5. Get Profile by ID (Admin)

- **Endpoint**: `GET /profiles/:id`
- **Access**: Admin only

### Response

- **Status**: `200 OK`
- Returns `CompleteProfileResponseDto`.

---

## 6. Update Profile by ID (Admin)

- **Endpoint**: `PUT /profiles/:id`
- **Access**: Admin only

### Request Body

- `UpdateCompleteProfileDto` (Same as above)

### Response

- **Status**: `200 OK`

---
⬅️ [Back to Documentation Hub](README.md)
