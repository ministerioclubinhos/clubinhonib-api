# GitHub Copilot Instructions — Clubinho NIB Backend

These instructions apply to all suggestions and edits in this repository.

Read and follow [`AGENTS.md`](../AGENTS.md), [`docs/CLUBINHO_BACKEND_BEST_PRACTICES.md`](../docs/CLUBINHO_BACKEND_BEST_PRACTICES.md), [`AI_DATABASE_CHANGE_REQUIREMENTS.md`](../AI_DATABASE_CHANGE_REQUIREMENTS.md) for database work, [`docs/error-handling.md`](../docs/error-handling.md), and applicable domain rules.

- Generate NestJS 11 and TypeScript code, not FastAPI/Python patterns.
- Controllers delegate; services orchestrate; repositories own TypeORM; providers own external APIs.
- Services MUST NEVER manipulate the database directly — they MUST ALWAYS delegate persistence and queries to repositories.
- A service in module A MUST NEVER inject or call a repository from module B; cross-module interaction MUST ALWAYS consume module B's service contract.
- When creating or editing any module, services MUST ALWAYS be split into separate operation files: `create`, `get`, `update`, and `delete`.
- Require explicit input DTOs (request/query) and output DTOs (response contracts) for all endpoints and operations. ALWAYS create dedicated files for `types` and `constants`, ALWAYS use domain enums for finite sets (no magic strings), ALWAYS create dedicated `utils` files for pure functions/logic, use explicit return types, and NEVER use `any` under any circumstances.
- Enforce guards, roles, assigned-club scope, ownership, transactions, standardized errors, and privacy-safe logs.
- Generate every schema migration automatically with the official TypeORM CLI/core `migration:generate` command. Never use `migration:create`, create/edit a migration manually, or deploy schema changes with `synchronize`.
- When a backend change creates or modifies a database schema or feature flow, create its PlantUML diagram if missing or update the existing one under `docs/diagrams/database/` or `docs/diagrams/flow/<feature-name>/`. Leave diagrams outside the current change untouched. Whenever a diagram is created or edited, ALWAYS generate its `.png` immediately (`npm run diagrams:generate`).
- Pair behavior changes with Jest tests and docs.
- Keep changes focused and preserve unrelated work.
