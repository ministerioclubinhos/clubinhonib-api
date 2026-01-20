# Core App API Documentation

This section covers root-level endpoints and core system health checks.

**Base URL**: `/` (Root)

## 📋 Endpoints

### 1. Health Check / Root

Basic connectivity check to verify the API is online.

- **Endpoint**: `GET /`
- **Response**: `Hello World!` or Status OK message.

### 2. System Status (If implemented)

Some systems expose a `/status` or `/health` endpoint here.

---

> **Note**: Most core functionality is distributed across specific modules (Auth, User, etc.). This controller primarily handles the initial entry point.

---
⬅️ [Back to Documentation Hub](README.md)
