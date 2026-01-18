# Auth Module Documentation

The **Auth Module** handles user authentication, registration, password recovery, and session management.

**Base URL**: `/auth`

---

## 1. Login User

Authenticates a user and returns a JWT token for session management.

- **Endpoint**: `POST /auth/login`
- **Access**: Public

### Request Body (`LoginDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | `@IsEmail`, `@IsNotEmpty` | User's registered email. |
| `password` | `string` | Yes | `@IsString`, `@IsNotEmpty` | User's password. |

#### Example Request JSON

```json
{
  "email": "teacher@example.com",
  "password": "strongPassword123"
}
```

### Response (`AuthResponse`)

- **Status**: `201 Created`

#### Example Response JSON

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "teacher@example.com",
    "name": "Jane Doe",
    "role": "teacher",
    "active": true
  }
}
```

### Possible Errors

- **401 Unauthorized**: Invalid email or password.
- **400 Bad Request**: Validation failed (e.g., invalid email format).

---

## 2. Register User

Registers a new user in the system.

- **Endpoint**: `POST /auth/register`
- **Access**: Public

### Request Body (`RegisterUserDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `name` | `string` | Yes | `@IsString`, `@IsNotEmpty` | Full name of the user. |
| `email` | `string` | Yes | `@IsEmail` | Valid email address. |
| `phone` | `string` | Yes | `@IsString`, `@IsNotEmpty` | Contact phone number. |
| `password` | `string` | Yes | `@MinLength(6)` | Password (min 6 characters). |
| `role` | `enum` | Yes | `@IsEnum(UserRole)` | One of: `admin`, `teacher`, `coordinator`. |

#### Example Request JSON

```json
{
  "name": "New Coordinator",
  "email": "coord@example.com",
  "phone": "5511999998888",
  "password": "securePass!23",
  "role": "coordinator"
}
```

### Response

- **Status**: `201 Created`
- Returns the created User object (without sensitive data like password).

#### Example Response JSON

```json
{
  "id": "987fcdeb-51a2-43d1-9876-543210987654",
  "name": "New Coordinator",
  "email": "coord@example.com",
  "phone": "5511999998888",
  "role": "coordinator",
  "active": true,
  "completed": false,
  "createdAt": "2024-01-01T10:00:00.000Z",
  "updatedAt": "2024-01-01T10:00:00.000Z"
}
```

### Possible Errors

- **409 Conflict**: Email already exists.
- **400 Bad Request**: Validation errors.

---

## 3. Complete Registration

Completes the registration for a user who might have been invited or partially created.

- **Endpoint**: `POST /auth/complete-register`
- **Access**: Public

### Request Body (`CompleteUserDto`)

| Field | Type | Required | Validations | Description |
| :--- | :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | `@IsEmail` | User's email (key). |
| `name` | `string` | Yes | `@IsNotEmpty` | Full Name. |
| `phone` | `string` | Yes | `@IsNotEmpty` | Phone number. |
| `password` | `string` | No | `@MinLength(6)` | Password (optional if already set). |
| `role` | `enum` | No | `@IsEnum` | Role update (optional). |

#### Example Request JSON

```json
{
  "email": "invited@example.com",
  "name": "Invited User",
  "phone": "5511888887777",
  "password": "finalPassword123"
}
```

### Response

- **Status**: `201 Created`
- Returns updated User object.

---

## 4. Google Login

Authenticates a user via Google OAuth token.

- **Endpoint**: `POST /auth/google`
- **Access**: Public

### Request Body

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `token` | `string` | Yes | Google ID Token provided by client. |

#### Example Request JSON

```json
{
  "token": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjF..."
}
```

### Response (`AuthResponse`)

- **Status**: `201 Created`
- Returns JWT Access Token + User Details.

---

## 5. Refresh Token

Refreshes an expired access token using a refresh token (if implemented).

- **Endpoint**: `POST /auth/refresh`
- **Access**: Public

### Request Body

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `refreshToken` | `string` | Yes | Valid refresh token. |

#### Example Request JSON

```json
{
  "refreshToken": "d748f..."
}
```

### Response

- **Status**: `201 Created`

```json
{
  "accessToken": "new.jwt.token..."
}
```

---

## 6. Get Current User (`Me`)

Retrieves detailed profile information for the authenticated user.

- **Endpoint**: `GET /auth/me`
- **Access**: Protected (`JwtAuthGuard`)
- **Headers**: `Authorization: Bearer <token>`

### Response (`MeResponseDto`)

- **Status**: `200 OK`

#### Example Response JSON

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "teacher@example.com",
  "phone": "5511999998888",
  "name": "Jane Doe",
  "active": true,
  "completed": true,
  "commonUser": false,
  "role": "teacher",
  "teacherProfile": {
    "id": "profile-uuid-1",
    "active": true,
    "club": {
      "id": "club-uuid-1",
      "number": 10,
      "weekday": "Saturday",
      "time": "14:00",
      "isActive": true
    }
  },
  "coordinatorProfile": null
}
```

---

## 7. Forgot Password

Initiates password recovery email.

- **Endpoint**: `POST /auth/forgot-password`
- **Access**: Public

### Request Body (`ForgotPasswordDto`)

| Field | Type | Required | Validations |
| :--- | :--- | :--- | :--- |
| `email` | `string` | Yes | `@IsEmail`, `@IsNotEmpty` |

#### Example Request JSON

```json
{
  "email": "forgot@example.com"
}
```

### Response

- **Status**: `201 Created`

```json
{
  "status": "RESET_LINK_SENT",
  "message": "Se o email existir, as instruções foram enviadas."
}
```

---

## 8. Validate Reset Token

Checks if a password reset token is valid/non-expired.

- **Endpoint**: `GET /auth/reset-password/validate`
- **Access**: Public
- **Query Params**: `token=<string>`

### Response

- **Status**: `200 OK`

```json
{
  "valid": true,
  "email": "user@example.com"
}
```

### Possible Errors

- **400 Bad Request**: Token invalid or expired.

---

## 9. Reset Password

Sets a new password using a valid token.

- **Endpoint**: `POST /auth/reset-password`
- **Access**: Public

### Request Body (`ResetPasswordDto`)

| Field | Type | Required | Validations |
| :--- | :--- | :--- | :--- |
| `token` | `string` | Yes | `@IsString`, `@IsNotEmpty` |
| `newPassword` | `string` | Yes | `@MinLength(6)` |

#### Example Request JSON

```json
{
  "token": "abc123token...",
  "newPassword": "newSecretPassword!"
}
```

### Response

- **Status**: `201 Created`

```json
{
  "message": "Senha alterada com sucesso."
}
```
