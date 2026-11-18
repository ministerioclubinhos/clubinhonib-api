# Profile Module Documentation

The **Profile Module** handles the extended profile information, specifically
**Personal Data** (demographics) and **User Preferences** (traits, favorites).

**Base URL**: `/profiles`

There are two profile surfaces, and they are not the same thing:

| Route | Owner | What it is |
| --- | --- | --- |
| `/profile` (singular) | `src/core/user/` | The signed-in user's **account**: name, e-mail, phone, CPF, password and photo. Answers `MyProfileResponseDto`, the same contract as `GET /auth/me`. |
| `/profiles` (plural) | `src/core/profile/` | The **extended** profile: personal data and preferences. Answers `CompleteProfileResponseDto`. |

Every response in both surfaces is built by a single mapper —
`toMyProfileResponse` and `toCompleteProfileResponse`. Five services used to
build these payloads by hand, and they had already drifted apart: `/auth/me`
omitted `active`, `completed`, `createdAt` and `updatedAt`, and `PUT /profiles/me`
answered without the photo that `GET /profiles/me` returned.

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
| `page` | `int` ≥ 1 | `1` | Page number. |
| `limit` | `int` 1–100 | `12` | Items per page. The ceiling is enforced by the DTO and again by the service. |
| `q` | `string` | - | Name or e-mail. |
| `name` | `string` | - | Filter by name. |
| `email` | `string` | - | Filter by e-mail. |
| `role` | `UserRole` | - | `admin`, `coordinator` or `teacher`. |
| `loveLanguages` | `string` | - | Filter by preference. |
| `temperaments` | `string` | - | Filter by preference. |
| `favoriteColor` | `string` | - | Filter by preference. |
| `sortBy` | `ProfileSortField` | `name` | `name`, `email`, `createdAt`, `birthDate`. |
| `order` | `ASC` \| `DESC` | `ASC` | |

An admin sees every profile; a coordinator sees only the teachers of the clubs
they coordinate. Ordering breaks ties by `u.id`, so paging never repeats or skips
a row.

#### Example Request URL

`GET /profiles?page=1&limit=20&role=teacher&loveLanguages=Quality%20Time`

### Response

- **Status**: `200 OK`
- Returns a paginated list of `CompleteProfileResponseDto` with
  `meta: { currentPage, itemsPerPage, totalItems, totalPages, hasNextPage, hasPreviousPage }`.

---

## 2.1 Birthdays of the current month

The listing screen shows a band of upcoming birthdays. It used to build that by
requesting the full listing with `limit=1000`, which returned complete profiles —
contact details and preferences included — for everyone, most of whom had no
birthday that month. This endpoint answers the same question directly.

- **Endpoint**: `GET /profiles/birthdays`
- **Access**: Protected (Admin, Coordinator) — same scope as the listing.
- **Response** (`ProfileBirthdayResponseDto[]`), bounded to 200 rows and ordered
  by day of month:

  ```json
  [
    {
      "id": "uuid-user",
      "name": "Marta Reis",
      "role": "coordinator",
      "birthDate": "1990-05-20",
      "image": { "id": "uuid-media", "url": "https://…", "title": null, "description": null, "uploadType": "upload", "mediaType": "image", "isLocalFile": true, "platformType": null, "originalName": "foto.jpg", "size": 12345 }
    }
  ]
  ```

  No e-mail, no phone, no preferences: the band shows a name, a photo and a date.

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
- **Access**: Protected (`JwtAuthGuard`) — **any** signed-in user edits their
  own profile. The previous version allowed only admin, coordinator and
  teacher, so a plain user got `403` when saving their own data on
  `/meu-perfil`.

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
- **Access**: Admin only (`AppForbiddenException` / `PERM_3001` otherwise)
- `:id` must be a UUID.

### Response

- **Status**: `200 OK`
- Returns `CompleteProfileResponseDto`.

---

## 6. Update Profile by ID (Admin)

- **Endpoint**: `PUT /profiles/:id`
- **Access**: Admin only
- `:id` must be a UUID.

### Request Body

- `UpdateCompleteProfileDto` (Same as above)

### Response

- **Status**: `200 OK`

---

## 7. Delete Profile (Admin)

- **Endpoint**: `DELETE /profiles/:id`
- **Access**: Admin only

### Response

```json
{ "message": "Perfil removido com sucesso" }
```

---

## CompleteProfileResponseDto

```typescript
{
  id: string;
  email: string;
  phone: string;
  name: string;
  role: string;
  image: {                      // null when the user has no photo
    id: string;
    title: string | null;
    description: string | null;
    url: string;
    uploadType: string;
    mediaType: string;
    isLocalFile: boolean;
    platformType: string | null;
    originalName: string | null;
    size: number | null;
  } | null;
  personalData?: {              // absent until the user fills it in
    birthDate?: string;         // YYYY-MM-DD
    gender?: string;
    gaLeaderName?: string;
    gaLeaderContact?: string;
  };
  preferences?: {               // absent until the user fills it in
    loveLanguages?: string;
    temperaments?: string;
    favoriteColor?: string;
    favoriteFood?: string;
    favoriteMusic?: string;
    whatMakesYouSmile?: string;
    skillsAndTalents?: string;
  };
}
```

`image` is this narrow shape, not the `MediaItemEntity` the contract used to
expose. The frontend mirrors it in `src/features/profile/types.ts`, and
`mappers.spec.ts` locks the exact key set on this side.

---
⬅️ [Back to Documentation Hub](README.md)
