# Communication API Documentation

This module handles all user interactions, feedback loops, and contact forms within the Clubinho NIB ecosystem.

## 📋 Index

1. [Site Feedbacks](#1-site-feedbacks)
2. [Comments](#2-comments)
3. [Contacts](#3-contacts)

---

## 1. Site Feedbacks

**Base URL**: `/site-feedbacks`

Collects general feedback from users about the system or club activities.

### Endpoints

#### `GET /site-feedbacks`

List all feedback received.

- **Access**: Admin only.
- **Filters**: `status` (OPEN, RESOLVED), `date`.

#### `POST /site-feedbacks`

Submit new feedback.

- **Access**: Public / Authenticated.
- **Body**:

  ```json
  {
    "type": "SUGGESTION", // or BUG, WRONG_INFO, etc.
    "message": "I think the text on the home page is too small.",
    "email": "user@example.com" // Optional if logged in
  }
  ```

#### `PUT /site-feedbacks/:id/resolve`

Mark feedback as resolved.

- **Access**: Admin only.

---

## 2. Comments

**Base URL**: `/comments`

Manages comments on content (posts, lessons, or specific pages).

### Endpoints

#### `GET /comments`

List comments, usually filtered by `targetId` (the item being commented on).

#### `POST /comments`

Add a comment.

- **Body**:

  ```json
  {
    "targetId": "uuid-of-content",
    "targetType": "MEDITATION", // or PAGE, VIDEO
    "content": "Great lesson!"
  }
  ```

#### `DELETE /comments/:id`

Remove a comment.

- **Access**: Admin or Owner of the comment.

---

## 3. Contacts

**Base URL**: `/contacts`

Manages contact forms (e.g., "Fale Conosco").

### Endpoints

#### `POST /contacts`

Send a contact message.

- **Body**:

  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "subject": "Doubts about enrollment",
    "message": "Hello, how do I enroll my son?"
  }
  ```

#### `GET /contacts`

List contact messages (Admin View).

---
⬅️ [Back to Documentation Hub](README.md)
