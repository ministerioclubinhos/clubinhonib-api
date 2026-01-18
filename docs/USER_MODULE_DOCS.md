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

### Response (`UserEntity`)

- **Status**: `201 Created`
- Returns the created User entity with ID.

---

## 2. List Users (Admin)

Retrieves a paginated list of users with optional filtering.

- **Endpoint**: `GET /users`
- **Access**: Protected (`JwtAuthGuard`, `AdminRoleGuard`)

### Query Parameters (`GetUsersQueryDto`)

| Param | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `page` | `int` | `1` | Page number. |
| `limit` | `int` | `12` | Items per page. |
| `q` | `string` | - | Search by name, email, or phone. |
| `role` | `enum` | - | Filter by `user`, `admin`, `coordinator`, `teacher`. |
| `active` | `bool` | - | Filter by active status (`true`/`false`). |
| `sort` | `string` | `updatedAt` | Sort field: `name`, `email`, `createdAt`, etc. |
| `order` | `enum` | `DESC` | Sort direction: `ASC` or `DESC`. |

#### Example Request URL

`GET /users?page=1&limit=10&role=teacher&sort=name&order=ASC`

### Response

- **Status**: `200 OK`

#### Example Response JSON

```json
{
  "items": [
    {
      "id": "uuid-1",
      "name": "Alice Teacher",
      "email": "alice@example.com",
      "role": "teacher",
      "active": true,
      "createdAt": "2024-01-15T12:00:00Z"
    },
    {
      "id": "uuid-2",
      "name": "Bob Coordinator",
      "email": "bob@example.com",
      "role": "coordinator",
      "active": true,
      "createdAt": "2024-01-10T12:00:00Z"
    }
  ],
  "meta": {
    "totalItems": 50,
    "itemCount": 2,
    "itemsPerPage": 10,
    "totalPages": 5,
    "currentPage": 1
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
| `role` | `enum` | No | `@IsEnum` | Change role. |
| `active` | `boolean` | No | - | Activate/Deactivate. |

#### Example Request JSON

```json
{
  "name": "Alice Updated",
  "active": false
}
```

### Response

- **Status**: `200 OK`
- Returns updated User entity.

---

## 4. Get Own Profile (User)

Retrieves the currently logged-in user's profile.

- **Endpoint**: `GET /profile`
- **Access**: Protected (`JwtAuthGuard`)

### Response

- **Status**: `200 OK`
- Returns the full User object including specialized profiles (`teacherProfile`, etc.).

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
- Returns updated User object with new `imageUrl` or `image` relation.
