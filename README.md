<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
  <h1 align="center">Clubinho NIB API</h1>
</p>

<div align="center">

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](/LICENSE)

</div>

<p align="center">
  The robust backend system powering the <strong>Clubinho NIB</strong> ecosystem. <br>
  Built with performance, scalability, and maintainability in mind using <strong>NestJS</strong>.
</p>

---

## 🚀 Features

The **Clubinho NIB API** acts as the central nervous system for managing children's clubs, offering a wide range of capabilities:

* **Club Management**: Full hierarchy management for clubs, coordinators, and teachers.
* **Attendance Tracking**: "Pagelas" system for weekly attendance, bible memorization, and activity tracking.
* **Smart Dashboard**: Aggregated metrics and real-time insights for administrators.
* **Content Management (CMS)**: Dynamic control over app content including Meditations, News, Videos, and Events.
* **User Engagement**: Feedback systems, comments, and direct communication channels.
* **Role-Based Access Control (RBAC)**: Secure access levels for Admins, Coordinators, Teachers, and Parents.

## 🛠 Tech Stack

* **Framework**: [NestJS](https://nestjs.com/) (Node.js)
* **Language**: TypeScript
* **Database**: PostgreSQL (via TypeORM)
* **Authentication**: JWT & OAuth2
* **Documentation**: Markdown-based internal docs

---

## 📚 Documentation

The full systems documentation is organized in our **[Documentation Hub](docs/README.md)**.

> **[👉 Click here to browse the full API Reference & Guides](docs/README.md)**

### Key Topics

- [**Getting Started & Automation**](docs/automation-checklist.md)
* [**API Reference**](docs/README.md#%EF%B8%8F-core-business-logic)
* [**Business Rules**](docs/implemented-rules.md)

---

## 🏁 Getting Started

### Prerequisites

* Node.js (v18+)
* npm or yarn
* PostgreSQL running locally or via Docker

### Installation

```bash
npm install
```

### Environment Setup

Create a `.env` file in the root directory based on `.env.example`.

### Running the App

```bash
# development
$ npm run start

# watch mode (recommended for dev)
$ npm run start:dev

# production mode
$ npm run start:prod
```

## 🧪 Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## 📜 License

This project is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
