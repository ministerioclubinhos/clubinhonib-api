# Error Handling System - Clubinhos NIB API

## Overview

The API uses a standardized error handling system with specific codes and a consistent response format.

## Error Response Format

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "USER_2001",
    "message": "User not found", // Human-readable message (in Portuguese for end-users)
    "details": null,
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/users/123"
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-----------|
| `success` | boolean | Always `false` for errors |
| `error.code` | string | Unique error code (see table below) |
| `error.message` | string | Friendly message in Portuguese (localized for UI) |
| `error.details` | any | Additional details (validation errors, specific fields, etc.) |
| `error.timestamp` | string | Error timestamp (ISO 8601) |
| `error.path` | string | Endpoint that generated the error |

## Error Codes by Category

### Authentication (AUTH_1xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `AUTH_1001` | 401 | Invalid credentials |
| `AUTH_1002` | 401 | Token expired |
| `AUTH_1003` | 401 | Invalid token |
| `AUTH_1004` | 401 | Token not provided |
| `AUTH_1005` | 401 | Invalid refresh token |
| `AUTH_1006` | 401 | Incorrect current password |
| `AUTH_1007` | 400 | New password is the same as current |

### User (USER_2xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `USER_2001` | 404 | User not found |
| `USER_2002` | 409 | User already exists |
| `USER_2003` | 409 | Email already in use |
| `USER_2004` | 403 | User inactive |
| `USER_2005` | 400 | Invalid recovery code |
| `USER_2006` | 400 | Recovery code expired |

### permission (PERM_3xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `PERM_3001` | 403 | Access denied |
| `PERM_3002` | 403 | Insufficient permissions |
| `PERM_3003` | 403 | Feature disabled |
| `PERM_3004` | 403 | Role not allowed |

### Validation (VAL_4xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `VAL_4001` | 422 | Validation error |
| `VAL_4002` | 422 | Invalid input |
| `VAL_4003` | 422 | Invalid file |
| `VAL_4004` | 422 | File required |
| `VAL_4005` | 422 | Invalid date range |
| `VAL_4006` | 422 | Invalid format |

### Resource (RES_5xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `RES_5001` | 404 | Resource not found |
| `RES_5002` | 409 | Resource conflict |
| `RES_5003` | 409 | Resource already exists |

### Club (CLUB_6xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `CLUB_6001` | 404 | Club not found |
| `CLUB_6002` | 409 | Club already exists |
| `CLUB_6003` | 409 | Club number in use |
| `CLUB_6004` | 403 | No access to club |

### Child (CHILD_7xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `CHILD_7001` | 404 | Child not found |
| `CHILD_7002` | 403 | No access to child |

### Profile (PROFILE_8xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `PROFILE_8001` | 404 | Profile not found |
| `PROFILE_8002` | 409 | Profile already exists |
| `PROFILE_8003` | 404 | Coordinator not found |
| `PROFILE_8004` | 404 | Teacher not found |
| `PROFILE_8005` | 403 | Invalid profile operation |

### Contact (CONTACT_85xx)

| Code | HTTP | Description |
|--------|------|-----------|
| `CONTACT_8501` | 404 | Contact not found |

### Content (CONTENT_86xx)

| Code | HTTP | Description |
|--------|------|-----------|
| `CONTENT_8601` | 404 | Document not found |
| `CONTENT_8602` | 404 | Meditation not found |
| `CONTENT_8603` | 404 | Informative not found |
| `CONTENT_8604` | 404 | Event not found |
| `CONTENT_8605` | 404 | Video not found |
| `CONTENT_8606` | 404 | Image not found |
| `CONTENT_8607` | 404 | Idea not found |
| `CONTENT_8608` | 404 | Route not found |
| `CONTENT_8609` | 404 | Comment not found |
| `CONTENT_8610` | 404 | Feedback not found |
| `CONTENT_8611` | 404 | Pagela (Report Card) not found |
| `CONTENT_8612` | 404 | Week Material not found |

### Internal (INT_9xxx)

| Code | HTTP | Description |
|--------|------|-----------|
| `INT_9001` | 500 | Internal server error |
| `INT_9002` | 500 | Database error |
| `INT_9003` | 500 | External service error |
| `INT_9004` | 500 | File upload error |
| `INT_9005` | 500 | Email send error |

## How to Throw Errors (Backend)

The project uses custom exceptions extending `AppException`. **Never** throw generic `Error` or NestJS `HttpException` directly for known business errors. Use the classes below:

### Exception Classes

 | Class | HTTP Status | Usage |
 |--------|-------------|-----|
 | `AppBusinessException` | 400 | Business rule violations, logical validation. |
 | `AppNotFoundException` | 404 | Resource not found (ID missing, route, file). |
 | `AppUnauthorizedException` | 401 | Authentication failure (invalid/expired token). |
 | `AppForbiddenException` | 403 | Authorization failure (insufficient permissions). |
 | `AppConflictException` | 409 | State conflict (email exists, duplicate resource). |
 | `AppValidationException` | 422 | Field validation error (DTOs). |
 | `AppInternalException` | 500 | Unexpected errors, infrastructure failure. |

### Usage Examples

 ```typescript
 import { AppNotFoundException, AppBusinessException, ErrorCode } from 'src/shared/exceptions';

 // Example 1: Resource not found
 const user = await this.repo.findOne(id);
 if (!user) {
   throw new AppNotFoundException(
     ErrorCode.USER_NOT_FOUND,
     'Usuário não encontrado' // Message in Portuguese
   );
 }

 // Example 2: Business Error
 if (user.isActive) {
   throw new AppBusinessException(
     ErrorCode.USER_ALREADY_EXISTS, // or more specific code
     'Usuário já está ativo'
   );
 }

 // Example 3: Internal Error (try-catch)
 try {
   await this.emailService.send();
 } catch (error) {
   this.logger.error(error);
   throw new AppInternalException(
     ErrorCode.EMAIL_SEND_ERROR,
     'Falha ao enviar email de boas-vindas'
   );
 }
 ```

## How to Handle Errors (Frontend)

### TypeScript/React Example

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
    path: string;
  };
}

async function handleApiError(response: Response): Promise<never> {
  const error: ApiError = await response.json();

  // Handle by code
  switch (error.error.code) {
    case 'AUTH_1001':
    case 'AUTH_1002':
    case 'AUTH_1003':
    case 'AUTH_1004':
      // Redirect to login
      window.location.href = '/login';
      break;

    case 'PERM_3001':
    case 'PERM_3002':
      // Show access denied message
      toast.error('You do not have permission for this action');
      break;

    default:
      // Show server message (already in Portuguese)
      toast.error(error.error.message);
  }

  throw error;
}

// Usage
try {
  const response = await fetch('/api/users');
  if (!response.ok) {
    await handleApiError(response);
  }
  return response.json();
} catch (error) {
  console.error('API Error:', error);
}
```

### Handling by HTTP Status

| Status | Recommended Action |
|--------|------------------|
| 400 | Show validation message |
| 401 | Redirect to login |
| 403 | Show "Access Denied" |
| 404 | Show "Not Found" |
| 409 | Show conflict (e.g., email already in use) |
| 422 | Show field validation errors |
| 500 | Show "Internal Error, please try again" |

## Form Validation

When the error contains `details` with field information:

```json
{
  "success": false,
  "error": {
    "code": "USER_2003",
    "message": "Este email já está em uso por outro usuário",
    "details": {
      "field": "email"
    },
    "timestamp": "2024-01-15T10:30:00.000Z",
    "path": "/api/users"
  }
}
```

Use `details.field` to highlight the input with error in your form.

## Best Practices

1. **Always check `success`**: If `false`, treat as error.
2. **Use `code` for logic**: More stable than the message string.
3. **Show `message` to user**: It is already provided in Portuguese.
4. **Log `timestamp` and `path`**: Useful for debugging.
5. **Handle network errors**: `catch` for when the request fails completely.

---

## Exception System Architecture

### Class Diagram

```
                    HttpException (NestJS)
                           │
                           ▼
                    ┌─────────────┐
                    │ AppException │  (base.exception.ts)
                    │─────────────│
                    │ + code      │
                    │ + message   │
                    │ + details   │
                    │ + httpStatus│
                    └─────┬───────┘
                          │
        ┌─────────────────┼─────────────────┐
        │         │       │       │         │
        ▼         ▼       ▼       ▼         ▼
   ┌─────────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────────┐
   │Business │ │Not  │ │Unau-│ │For- │ │Conflict │
   │Exception│ │Found│ │thor-│ │bidd-│ │Exception│
   │  (400)  │ │(404)│ │ized │ │en   │ │  (409)  │
   └─────────┘ └─────┘ │(401)│ │(403)│ └─────────┘
                       └─────┘ └─────┘
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
   ┌──────────┐                      ┌──────────┐
   │Validation│                      │Internal  │
   │Exception │                      │Internal  │
   │  (422)   │                      │Option    │
   └──────────┘                      └──────────┘
```

### Error Handling Flow

```
 HTTP Request
       │
       ▼
┌──────────────┐
│  Controller  │
└──────┬───────┘
       │
       ▼
┌──────────────┐     throw AppException
│   Service    │ ─────────────────────────┐
└──────┬───────┘                          │
       │                                  ▼
       │                    ┌─────────────────────────┐
       │                    │ GlobalExceptionFilter   │
       │                    │─────────────────────────│
       │                    │ 1. Catch exception      │
       │                    │ 2. Identify type        │
       │                    │ 3. Format response      │
       │                    │ 4. Log error            │
       │                    │ 5. Send JSON response   │
       │                    └───────────┬─────────────┘
       │                                │
       ▼                                ▼
  Response OK                     Error Response
```

### File Structure

```
src/shared/exceptions/
├── index.ts                          # Centralized exports
├── error-codes.enum.ts               # Enum with all error codes
├── base.exception.ts                 # Base Class AppException
├── business.exception.ts             # AppBusinessException (400)
├── not-found.exception.ts            # AppNotFoundException (404)
├── unauthorized.exception.ts         # AppUnauthorizedException (401)
├── forbidden.exception.ts            # AppForbiddenException (403)
├── conflict.exception.ts             # AppConflictException (409)
├── validation.exception.ts           # AppValidationException (422)
├── internal.exception.ts             # AppInternalException (500)
├── filters/
│   └── global-exception.filter.ts    # Global exception filter
└── interfaces/
    └── error-response.interface.ts   # Error response interface
```

---

## Technical Implementation Details

### Base Class (AppException)

```typescript
// src/shared/exceptions/base.exception.ts
import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from './error-codes.enum';

export class AppException extends HttpException {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    httpStatus: HttpStatus,
    public readonly details?: unknown,
  ) {
    super({ code, message, details }, httpStatus);
  }

  getCode(): ErrorCode {
    return this.code;
  }

  getDetails(): unknown {
    return this.details;
  }
}
```

### GlobalExceptionFilter

The global filter intercepts **all** application exceptions:

```typescript
// src/shared/exceptions/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = this.buildErrorResponse(exception, request);
    const status = this.getHttpStatus(exception);

    // Log with appropriate level
    if (status >= 500) {
      this.logger.error(
        `[${errorResponse.error.code}] ${errorResponse.error.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${errorResponse.error.code}] ${errorResponse.error.message} - ${request.method} ${request.url}`,
      );
    }

    response.status(status).json(errorResponse);
  }
}
```

---
⬅️ [Back to Documentation Hub](README.md)
