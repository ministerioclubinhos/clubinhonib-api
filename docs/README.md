# 📚 Clubinho NIB - Documentation Hub

Welcome to the official documentation for the **Clubinho NIB API**. This hub serves as the central index for all technical guides, API references, and business logic definitions.

---

## 🚀 Getting Started

- [**Automation Checklist**](automation-checklist.md)  
   _How to run test scripts, seed data, and automate system maintenance._
- [**Scripts Technical Readme**](../scripts/README.md)  
   _Internal details of the `scripts/` folder._

---

## ⚙️ Core Business Logic

| Document                                          | Description                                                                    |
| :------------------------------------------------ | :----------------------------------------------------------------------------- |
| [**Children & Clubs**](api-children-clubs.md)     | Endpoints for managing the core hierarchy of clubs and children.               |
| [**Education & Spirituality**](api-education.md)  | Academic years, weekly "Pagelas" (attendance), and spiritual decisions.        |
| [**Implemented Rules**](implemented-rules.md)     | Deep dive into business logic (e.g., `isActive` rules, academic periods).      |
| [**Pendências técnicas**](pendencias-tecnicas.md) | Dívida levantada na varredura, em ordem de prioridade, com caixas para marcar. |

---

## 🔹 Administration & Dashboards

| Document                                              | Description                                                                    |
| :---------------------------------------------------- | :----------------------------------------------------------------------------- |
| [**Dashboard Endpoints**](api-dashboard-endpoints.md) | High-performance endpoints for the administrative dashboard.                   |
| [**Statistics**](api-statistics.md)                   | Numerador, denominador e fuso de cada métrica das onze rotas de `/statistics`. |
| [**Profiles Admin**](api-profiles-admin.md)           | Role management for Teachers and Coordinators.                                 |
| [**User & Auth**](auth-module.md)                     | Authentication flows, user management, and security.                           |
| [**Feature Flags**](api-feature-flags.md)             | Dynamic feature toggling system.                                               |
| [**Observabilidade e Auditoria**](observability-audit.md) | Registros técnicos e de ações: captura transversal, storage `file`/DynamoDB, API administrativa de consulta. |
| [**Core / Health**](api-core-app.md)                  | Root endpoints and system health.                                              |

---

## 📝 Content & Communication

| Document                                            | Description                                                                          |
| :-------------------------------------------------- | :----------------------------------------------------------------------------------- |
| [**Content Management**](api-content-management.md) | CMS features: Pages, Meditations, Informatives, Documents.                           |
| [**Week Materials**](api-week-materials.md)         | Weekly material pages: contract, media synchronization, and current-week publishing. |
| [**Estúdio Clubinho**](api-ai-lessons.md)           | Produção versionada, revisão e publicação idempotente de lições.                       |
| [**Communication**](api-communication.md)           | Feedback, Comments, and Contact forms.                                               |
| [**Central de Notificações**](notifications.md)    | Sininho: fachada `/notifications/me`, resumo, filtros e leitura em lote.            |
| [**E-mail**](email.md)                              | Transporte SMTP, a casca dos templates e a confirmação de endereço.                  |
| [**Agendador**](scheduling.md)                      | Jobs por horário: o runner, `SCHEDULER_ENABLED` e como escrever um job.              |
| [**Addresses**](api-addresses.md)                   | Geolocation and address management.                                                  |

---

## 📊 Reporting & Analytics

| Document                                          | Description                                          |
| :------------------------------------------------ | :--------------------------------------------------- |
| [**Statistics API**](api-statistics.md)           | Full analytics engine: Attendance, Growth, Rankings. |
| [**Statistics Review**](api-statistics-review.md) | _Internal Audit_ of statistics logic compliance.     |

---

## 👤 User Profiles

| Document                                | Description                                              |
| :-------------------------------------- | :------------------------------------------------------- |
| [**User Module**](user-module.md)       | Account operations and basic user data.                  |
| [**Profile Module**](profile-module.md) | Extended profile data (preferences, bio, personal info). |

---

## 📐 Diagrams & Architecture (PlantUML)

| Category | Path | Description |
| :--- | :--- | :--- |
| **Diagram Index** | [`docs/diagrams/README.md`](diagrams/README.md) | Navigable list of database and feature diagrams. |
| **Database Schemas** | [`docs/diagrams/database/`](diagrams/database/) | Database ER schema diagrams in PlantUML (`.puml`) and rendered images (`.png`). |
| **Feature Flows** | [`docs/diagrams/flow/`](diagrams/flow/) | Feature-specific execution flow diagrams structured per feature folder (`.puml` + `.png`). |

## 🧭 Implementation Plans

- [Estúdio Clubinho — plano de 2026-11-01 (implementado, histórico)](implementation-plan/studio-clubinho-improvements-2026-11-01.md)
- [Estúdio Clubinho — plano de outubro/2026 (superado)](implementation-plan/estudio-clubinho-improvements-implementation-plan.md)
- [Media Streaming](implementation-plan/media-streaming-implementation-plan.md)
- [Observability Audit](implementation-plan/observability-audit-implementation-plan.md)
