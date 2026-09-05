# Repository Instructions — Clubinho NIB Backend

## Scope

These instructions apply to the entire `clubinhonib-api` repository.

## Mandatory Source of Truth

Before modifying any source, test, configuration, database, or documentation file, read and comply with:

- [`docs/CLUBINHO_BACKEND_BEST_PRACTICES.md`](docs/CLUBINHO_BACKEND_BEST_PRACTICES.md)
- [`AI_DATABASE_CHANGE_REQUIREMENTS.md`](AI_DATABASE_CHANGE_REQUIREMENTS.md) for every database, entity, relation, index, or schema change.
- [`docs/error-handling.md`](docs/error-handling.md) for the error envelope and catalog.
- [`docs/implemented-rules.md`](docs/implemented-rules.md) for domain behavior.

The backend best-practices document is the canonical detailed guide. This file is the always-loaded entrypoint and does not replace it.

## Repository Context

- Application: Clubinho NIB API.
- Stack: NestJS 11, TypeScript, TypeORM, MySQL, class-validator/class-transformer, JWT/Passport, Jest, and Supertest.
- Frontend consumer: sibling repository `../clubinhonib-app`.
- User-facing messages: Portuguese. Engineering documentation and code identifiers: English.

## Non-Negotiable Rules

1. Controllers contain HTTP concerns and delegate use cases. They must not access TypeORM, implement business rules, or call third-party APIs directly.
2. Services own business rules and orchestration. Services MUST NEVER manipulate the database or call TypeORM directly — they MUST ALWAYS delegate database access and persistence to repositories. A service in module A MUST NEVER inject or call a repository from module B; cross-module interaction MUST ALWAYS be performed by calling module B's service contract. When creating or editing any module, services MUST ALWAYS be split into separate operation-focused files: `create`, `get`, `update`, and `delete`. Repositories own database access. Providers own AWS, Twilio, Google, email, and other external integrations.
3. Every endpoint and operation MUST define explicit input DTOs (request body/query/params) and explicit output DTOs (response DTOs) for everything. Do not bind requests directly to entities or expose raw, unrestricted entities.
4. NEVER use `any` under any circumstances. Use explicit types for everything and narrow `unknown` at boundaries. ALWAYS use domain enums for roles, statuses, weekdays, categories, attendance values, and finite sets (never magic strings).
5. ALWAYS create dedicated files for `types` (`types.ts` or DTO files) and `constants` (`constants.ts`) — never declare types, interfaces, magic numbers, or config constants inline inside controllers, services, repositories, or providers.
6. ALWAYS create dedicated `utils` / helper files for reusable pure domain logic, formatters, and data transformations instead of duplicating logic inline inside controllers, services, or repositories.
7. Enforce authentication, role, assigned-club scope, ownership, and feature flags consistently across list, detail, mutation, statistics, and export endpoints.
8. Use established application exceptions and the global `{ success: false, error: ... }` envelope. Preserve specific error codes.
9. Multi-write operations require a transaction, and every write inside it must use the same transactional `EntityManager`.
10. Every schema migration MUST be generated automatically by the official TypeORM CLI/core through `migration:generate`, using the repository `DataSource` and the entity/schema diff. Never use `migration:create`, create or edit a migration manually, or use `synchronize` as the deployment mechanism. If generated output is wrong, fix the entities or `DataSource` and regenerate it.
11. Every e-mail notification MUST sit behind its own feature flag — one flag per notification, never shared with the flag of the feature that originates it, and never absent. A new e-mail requires, together: a value in `EmailNotification`, an `email_`-prefixed key in `FeatureFlagKeys`, the pair in `EMAIL_NOTIFICATION_FLAGS`, the flag seeded in `DEFAULT_FEATURE_FLAGS` as `enabled: true` with empty `targetRoles`, and a send method routed through `EmailService.dispatch`/`dispatchBulk`. See [`docs/email.md`](docs/email.md).
12. Never log tokens, passwords, authorization headers, children's data, guardian details, uploaded contents, or unnecessary personal data.
13. Every behavior change requires tests. Bug fixes require a regression test. External services and databases must be mocked.
14. Update API docs, implemented rules, error docs, and automation examples when their behavior changes.
15. Do not modify environments, deployments, infrastructure, shared databases, or production data without explicit authorization.
16. Preserve unrelated user changes and keep the final diff limited to the requested outcome.

## Required Implementation Workflow

1. Read the complete affected module and trace controller → service → repository/provider → DTO.
2. Verify guards, club scope, relations, statistics definitions, transactions, and error contracts.
3. Implement the smallest cohesive change using dependency injection and explicit types.
4. For schema changes, follow `AI_DATABASE_CHANGE_REQUIREMENTS.md` and let TypeORM generate the migration before continuing.
5. Add or update unit/integration tests and contract/domain documentation.
6. Run checks proportional to the change and inspect the final diff.

When existing code conflicts with the canonical guide, do not copy the inconsistency and do not perform an unrelated mass refactor. Apply the standard within scope and report remaining debt.

## Verification

```bash
NODE_OPTIONS='--max-old-space-size=2048' npm run build
NODE_OPTIONS='--max-old-space-size=2048' npm test -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run test:cov -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run lint
```

The lint script currently applies fixes; inspect its diff. A change is incomplete if its relevant build, tests, coverage, or lint fail.
