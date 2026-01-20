# Feature Flags API Documentation

The **Feature Flags** module allows for dynamic toggling of system features without deploying new code. This is useful for phased rollouts, A/B testing, or emergency kill switches.

**Base URL**: `/feature-flags`

## 📋 Index

1. [List Flags](#1-list-flags)
2. [Get Flag](#2-get-flag)
3. [Create Flag](#3-create-flag)
4. [Update Flag](#4-update-flag)
5. [Delete Flag](#5-delete-flag)

---

## 1. List Flags

Retrieve all feature flags configured in the system.

- **Endpoint**: `GET /feature-flags`
- **Access**: Admin / Authenticated (depending on configuration)

### Response

```json
[
  {
    "id": "uuid...",
    "key": "ENABLE_NEW_DASHBOARD",
    "description": "Enables the new React-based dashboard",
    "isEnabled": true,
    "createdAt": "2025-01-01T10:00:00Z"
  }
]
```

---

## 2. Get Flag

Check the status of a specific flag by its key.

- **Endpoint**: `GET /feature-flags/:key`
- **Params**: `key` (string, e.g., `ENABLE_NEW_DASHBOARD`)

### Response

```json
{
  "key": "ENABLE_NEW_DASHBOARD",
  "isEnabled": true
}
```

---

## 3. Create Flag (Admin)

Register a new feature flag.

- **Endpoint**: `POST /feature-flags`
- **Access**: Admin only

### Body

```json
{
  "key": "NEW_FEATURE_KEY",
  "description": "Description of what this flag controls",
  "isEnabled": false
}
```

---

## 4. Update Flag (Admin)

Toggle a flag on or off.

- **Endpoint**: `PATCH /feature-flags/:id`
- **Access**: Admin only

### Body

```json
{
  "isEnabled": true
}
```

---

## 5. Delete Flag (Admin)

Remove a feature flag constant.

- **Endpoint**: `DELETE /feature-flags/:id`

---
⬅️ [Back to Documentation Hub](README.md)
