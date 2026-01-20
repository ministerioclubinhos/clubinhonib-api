# Content Management API Documentation

This documentation covers the CMS (Content Management System) features of the Clubinho NIB API. These modules allow administrators to manage dynamic content displayed on the app/website.

## 📋 Index

1. [Pages Management](#1-pages-management)
2. [Meditations](#2-meditations)
3. [Informatives](#3-informatives)
4. [Documents](#4-documents)
5. [Routes](#5-routes)

---

## 1. Pages Management

The application uses a dynamic page system where content is divided into specific page types.

### Generic Page Endpoints

Most page controllers follow a standard CRUD pattern.

**Common Base URLs:**

- `/pages/week-material`
- `/pages/video`
- `/pages/image` (includes sections)
- `/pages/ideas` (includes sections)
- `/pages/event`

### 1.1 Week Material Page

**Base URL**: `/pages/week-material`

- `GET /` - List all materials (paginated)
- `GET /:id` - Get specific material
- `POST /` - Create new material
- `PUT /:id` - Update material
- `DELETE /:id` - Remove material

### 1.2 Video Page

**Base URL**: `/pages/video`

- `GET /` - List videos
- `POST /` - Register new video (YouTube/Vimeo links)

### 1.3 Image Page & Sections

**Base URL**: `/pages/image`

Manages galleries or visual sections.

- `GET /` - List image pages
- `GET /:id/sections` - List sections within an image page
- `POST /` - Create image page
- `POST /section` - Add section to a page

### 1.4 Ideas Page & Sections

**Base URL**: `/pages/ideas`

Manages the "Ideas" section for teachers.

- `GET /` - List idea pages
- `POST /` - Create idea page
- `POST /section` - Create idea section

### 1.5 Event Page

**Base URL**: `/pages/event`

Manages upcoming events.

- `GET /` - List events
- `POST /` - Create event
- `PUT /:id` - Update event details

---

## 2. Meditations

**Base URL**: `/meditations`

Manages daily or weekly meditations content.

### Endpoints

- `GET /` - List meditations (paginated)
- `GET /:id` - Get details
- `POST /` - Create meditation
- `PUT /:id` - Update meditation
- `DELETE /:id` - Delete

**DTO Fields (Create):**

- `title` (string)
- `content` (text/html)
- `date` (ISO date)
- `active` (boolean)

---

## 3. Informatives

**Base URL**: `/informatives`

News and announcements for the clubinho community.

### Endpoints

- `GET /` - List informatives
- `POST /` - Create informative
- `PUT /:id` - Update
- `DELETE /:id` - Delete

---

## 4. Documents

**Base URL**: `/documents`

Repository for official documents (PDFs, guidelines).

### Endpoints

- `GET /` - List available documents
- `POST /` - Upload/Register document
- `DELETE /:id` - Remove from registry

---

## 5. Routes

**Base URL**: `/routes`

Manages dynamic routing configuration for the frontend application.

### Endpoints

- `GET /` - List all configured routes
- `GET /:path` - Resolve specific route configuration

---

## 🔐 Permissions

- **Read Operations (GET)**: Generally public or authenticated users.
- **Write Operations (POST, PUT, DELETE)**: restricted to **Admin** and **Coordinator** roles.

---
⬅️ [Back to Documentation Hub](README.md)
