# Profile Administration API

This module handles the specific administrative linking between Users and their Roles (Teachers/Coordinators) within Clubs.

> **Note**: For general user profile data (preferences, bio), see the [Profile Module](profile-module.md).

## 📋 Index

1. [Teacher Profiles](#1-teacher-profiles)
2. [Coordinator Profiles](#2-coordinator-profiles)

---

## 1. Teacher Profiles

**Base URL**: `/teacher-profiles`

A Teacher Profile links a **User** to one or more **Clubs**.

### Endpoints

#### `GET /teacher-profiles`

List all teachers.

- **Includes**: Linked User data, Linked Clubs.

#### `POST /teacher-profiles`

Manually create a teacher profile (often done automatically via User Create).

- **Body**:

  ```json
  {
    "userId": "uuid-user",
    "clubIds": ["uuid-club-1"]
  }
  ```

#### `PUT /teacher-profiles/:id/clubs`

Update the clubs a teacher is assigned to.

- **Body**:

  ```json
  {
    "clubIds": ["uuid-club-new"] // Replaces existing links
  }
  ```

---

## 2. Coordinator Profiles

**Base URL**: `/coordinator-profiles`

A Coordinator Profile links a **User** to **Clubs** they coordinate.

### Endpoints

#### `GET /coordinator-profiles`

List all coordinators.

#### `POST /coordinator-profiles`

Create a coordinator profile.

- **Body**:

  ```json
  {
    "userId": "uuid-user",
    "active": true
  }
  ```

#### `PUT /coordinator-profiles/:id`

Update coordinator status or details.

---

## 🔗 Relationships

- **User** (1) ↔ (0/1) **TeacherProfile** ↔ (N) **Clubs**
- **User** (1) ↔ (0/1) **CoordinatorProfile** ↔ (N) **Clubs**

A single user can technically have both profiles, though typically they hold one role at a time in the context of a specific club.

---
⬅️ [Back to Documentation Hub](README.md)
