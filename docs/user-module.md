# User Module Documentation

The **User Module** is responsible for managing user accounts, perform administrative updates, and handling user-specific profile operations (basic account info).

**Base URL**:

- Admin Operations: `/users`
- User Operations: `/profile`

---

## 1. Create User (Admin)

Creates a new user manually. Only accessible by Admins.

- **Endpoint**: `POST /users`
- **Access**: Protected (`JwtAuthGuard`, `AdminRoleGuard`)

### Request Body (`CreateUserDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | `@IsString` | Full name. |
| `email` | `string` | Yes | `@IsEmail` | Unique email. |
| `password` | `string` | Yes | `@MinLength(6)` | Initial password. |
| `phone` | `string` | Yes | `@IsString` | Phone number. |
| `role` | `enum` | No | `@IsEnum` | `admin`, `teacher`, `coordinator`. |
| `active` | `boolean` | No | - | Account status (default true). |

#### Example Request JSON

```json
{
  "name": "New Teacher",
  "email": "teacher.new@example.com",
  "password": "initialPass123",
  "phone": "5511988887777",
  "role": "teacher",
  "active": true
}
```

### Response (`UserResponseDto`)

- **Status**: `201 Created`
- Returns the public contract below. The route **never** returns the entity:
  `password` and `refreshToken` are columns of `UserEntity` and must not leave
  the API.

```json
{
  "id": "uuid-1",
  "name": "Alice Teacher",
  "email": "alice@example.com",
  "phone": "92999990000",
  "cpf": null,
  "role": "teacher",
  "active": true,
  "completed": false,
  "commonUser": true,
  "createdAt": "2026-01-15T12:00:00.000Z",
  "updatedAt": "2026-01-15T12:00:00.000Z"
}
```

---

## 2. List Users (Admin)

Retrieves a paginated list of users with optional filtering.

- **Endpoint**: `GET /users`
- **Access**: Protected (`JwtAuthGuard`, `AdminRoleGuard`)

### Query Parameters (`GetUsersQueryDto`)

| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `int` ≥ 1 | `1` | Page number. |
| `limit` | `int` 1–100 | `12` | Items per page; the maximum is enforced by the DTO and again by the repository. |
| `q` | `string` | - | Search by name, email, phone, or role. |
| `role` | `UserRole` | - | `admin`, `coordinator` or `teacher`. Any other value is rejected with `400`. |
| `active` | `bool` | - | `true`/`false`; anything else drops the filter. |
| `completed` | `bool` | - | `true`/`false`. |
| `sort` | `UserSortField` | `updatedAt` | `name`, `email`, `phone`, `role`, `createdAt`, `updatedAt`. |
| `order` | `ASC` \| `DESC` | `DESC` | Case-insensitive. |

Administrators are excluded from the listing: the screen manages who works in the
clubinho, and one admin is not managed from there.

Ordering breaks ties by `u.id`, so paging never repeats or skips a row.

#### Example Request URL

`GET /users?page=1&limit=10&role=teacher&sort=name&order=ASC`

### Response (`PaginatedUsersResponseDto`)

- **Status**: `200 OK`

#### Example Response JSON

```json
{
  "items": [
    {
      "id": "uuid-1",
      "name": "Alice Teacher",
      "email": "alice@example.com",
      "phone": "92999990000",
      "cpf": null,
      "role": "teacher",
      "active": true,
      "completed": true,
      "commonUser": false,
      "createdAt": "2026-01-15T12:00:00.000Z",
      "updatedAt": "2026-01-16T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 50,
    "totalPages": 5,
    "sort": "updatedAt",
    "order": "DESC"
  }
}
```

---

## 3. Update User (Admin)

Updates any user's account details.

- **Endpoint**: `PUT /users/:id`
- **Access**: Protected (`JwtAuthGuard`, `AdminRoleGuard`)
- **Params**: `id` (UUID)

### Request Body (`UpdateUserDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | No | `@IsString` | Update name. |
| `email` | `string` | No | `@IsEmail` | Update email. |
| `password` | `string` | No | `@MinLength(6)` | **Reset password** (Admin can overwrite). |
| `phone` | `string` | No | `@IsString` | Update phone (digits only). |
| `role` | `UserRole` | No | `@IsEnum` | Change role; the matching teacher/coordinator profile is created and the old one removed. |
| `active` | `boolean` | No | `@IsBoolean` | Activate/Deactivate. The profile follows, but is **not** deleted — see below. |
| `completed` | `boolean` | No | `@IsBoolean` | Mark the registration as complete. |
| `commonUser` | `boolean` | No | `@IsBoolean` | Distinguishes a ministry account from a common one. |
| `cpf` | `string` | No | `@IsString` | Unique; a duplicate returns `409`. |

#### Example Request JSON

```json
{
  "name": "Alice Updated",
  "active": false
}
```

#### Effect on the teacher/coordinator profile

| Change | Profile | Club link |
| :--- | :--- | :--- |
| `active` toggled | `active` follows the account | **preserved** |
| `role` changed | old profile deleted, new one created | old link dropped with the old profile |

Deactivating used to delete the profile, taking the club link with it;
reactivating produced a profile with no club and said nothing. See
[Profile Administration](api-profiles-admin.md#4-relationships-and-lifecycle).

### Response (`UserResponseDto`)

- **Status**: `200 OK`
- Same contract as the create route — the entity, with its password hash and
  refresh token, never leaves the API.

---

## 4. Get Own Profile (User)

Retrieves the currently logged-in user's profile.

- **Endpoint**: `GET /profile`
- **Access**: Protected (`JwtAuthGuard`)

### Response

- **Status**: `200 OK`
- Returns `MyProfileResponseDto`.

`GET /auth/me`, `PATCH /profile`, `PATCH /profile/image` and this endpoint all
answer **the same** `MyProfileResponseDto`, built by `toMyProfileResponse`.
`/auth/me` used to build its own copy that omitted `active`, `completed`,
`createdAt` and `updatedAt`.

```typescript
{
  id: string;
  email: string;
  name: string;
  phone: string;
  cpf: string | null;
  role: string;
  active: boolean;
  completed: boolean;
  commonUser: boolean;
  createdAt: string;            // ISO
  updatedAt: string;            // ISO
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
  personalData?: { ... };       // see profile-module.md
  preferences?: { ... };        // see profile-module.md
  teacherProfile: {             // null when the user is not a teacher
    id: string;
    active: boolean;
    club: { id, number, weekday, time, isActive } | null;
  } | null;
  coordinatorProfile: {         // null when the user is not a coordinator
    id: string;
    active: boolean;
    clubs: Array<{ id, number, weekday, time, isActive }>;
  } | null;
}
```

The frontend mirrors this as `MyProfile` in `src/features/profile/types.ts`,
and it is also the Redux `User` — one declaration, not two.

---

## 5. Update Own Profile (User)

Allows a user to update their own basic account information.

- **Endpoint**: `PATCH /profile`
- **Access**: Protected (`JwtAuthGuard`)

### Request Body (`UpdateOwnProfileDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | No | `@MinLength(2)` | Update display name. |
| `email` | `string` | No | `@IsEmail` | Update contact email. |
| `phone` | `string` | No | `@IsString` | Update phone. |
| `cpf` | `string` | No | `@IsString` | Update CPF; conflicts answer `409`. |

#### Example Request JSON

```json
{
  "name": "Jane User",
  "phone": "5511977776666"
}
```

### Response

- **Status**: `200 OK`
- Returns the updated User profile.

---

## 6. Change Password (User)

Allows a user to change their own password.

- **Endpoint**: `PATCH /profile/password`
- **Access**: Protected (`JwtAuthGuard`)

### Request Body (`ChangePasswordDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `currentPassword` | `string` | Conditional | - | Required for standard users. |
| `newPassword` | `string` | Yes | `@MinLength(6)` | New password. |

#### Example Request JSON

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecurePass!999"
}
```

### Response

- **Status**: `200 OK`

```json
{
  "message": "Senha alterada com sucesso."
}
```

---

## 7. Update Profile Image

Uploads or updates the user's avatar.

- **Endpoint**: `PATCH /profile/image` (Own) OR `PATCH /users/:id/image` (Admin)
- **Access**: Protected

### Request Format: `multipart/form-data`

| Field | Type | Description |
| :--- | :--- | :--- |
| `file` | `File` | The image file (jpg, png). |
| `imageData` | `JSON String` | Optional metadata (e.g., `{"title": "Avatar"}`). |

### Response

- **Status**: `200 OK`
- `PATCH /profile/image` returns `MyProfileResponseDto` — the same contract as
  `GET /profile` and `GET /auth/me`, already carrying the new `image`.
- `PATCH /users/:id/image` returns `UserResponseDto`, the administrative
  contract. It does not carry the media itself; read the profile route when the
  new URL is needed.

---
⬅️ [Back to Documentation Hub](README.md)
