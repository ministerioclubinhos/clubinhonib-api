# Gemini Project Instructions — Clubinho NIB Backend

Before making changes, read and follow:

1. [`AGENTS.md`](AGENTS.md)
2. [`docs/CLUBINHO_BACKEND_BEST_PRACTICES.md`](docs/CLUBINHO_BACKEND_BEST_PRACTICES.md)
3. [`AI_DATABASE_CHANGE_REQUIREMENTS.md`](AI_DATABASE_CHANGE_REQUIREMENTS.md) for database work
4. [`docs/error-handling.md`](docs/error-handling.md) and [`docs/implemented-rules.md`](docs/implemented-rules.md) when applicable

Keep NestJS controllers, services, repositories, DTOs/entities, and providers separated. Services MUST NEVER manipulate the database directly and MUST ALWAYS delegate persistence to repositories. A service in module A MUST NEVER inject or call a repository from module B, but MUST ALWAYS call module B's service. When creating or editing any module, services MUST ALWAYS be split into separate operation files: create, get, update, and delete. Require explicit input DTOs and output DTOs for all endpoints and operations (no raw entity exposure). ALWAYS create dedicated files for `types` and `constants`, ALWAYS use domain enums for finite sets (no magic strings), ALWAYS create dedicated `utils` files for pure functions/logic, and use explicit types with NEVER any `any` under any circumstances. Use TypeORM transactions, API-side club authorization, privacy-safe logging, scoped statistics, Jest coverage, and synchronized documentation. Schema migrations must be generated automatically by the official TypeORM CLI/core through `migration:generate`; never use `migration:create` or create/edit them manually. When a backend change creates or modifies a database schema or feature flow, create its PlantUML diagram if missing or update the existing one under `docs/diagrams/database/` or `docs/diagrams/flow/<feature-name>/`. Leave diagrams outside the current change untouched. Whenever a diagram is created or edited, ALWAYS generate its `.png` immediately (`npm run diagrams:generate`).
