# Clubinho NIB Backend Best Practices & Engineering Guidelines

## 1. Purpose and Scope

This document defines the mandatory engineering standards for `clubinhonib-api`. AI coding assistants and human developers MUST read it before creating, fixing, or refactoring backend code.

This backend is a NestJS 11 application written in TypeScript. The running configuration uses TypeORM with MySQL, class-validator/class-transformer, JWT/Passport, AWS SDK integrations, Jest, and Supertest. Source code and environment-aware configuration take precedence over stale stack descriptions in older documentation.

Core principles:

- Preserve public API and database contracts unless the requested change explicitly modifies them.
- Keep HTTP transport, business rules, persistence, and external integrations in separate layers.
- Prefer narrow, testable changes over unrelated repository-wide refactors.
- Treat authentication, authorization, and the privacy of children and families as part of every feature.
- Do not alter environment, infrastructure, deployment, or production data without explicit authorization.

## 2. Mandatory Pre-Change Workflow

Before implementing a change:

1. Read `package.json`, `tsconfig.json`, `src/main.ts`, `src/app.module.ts`, and the complete affected module.
2. Read `AI_DATABASE_CHANGE_REQUIREMENTS.md` for database work, `docs/error-handling.md`, `docs/implemented-rules.md`, and the relevant API/domain document listed in `docs/README.md`.
3. Trace the request path: controller → service → repository/provider → entity and back through response DTOs.
4. Inspect guards, roles, club scope, ownership rules, feature flags, relations, and transaction boundaries.
5. Search for equivalent patterns already used by a well-structured module.
6. Locate unit, integration, automation, and contract documentation that must change with the behavior.
7. Preserve unrelated local changes and do not format files outside the task scope.

### 2.1 AI Instruction Discovery and Execution Protocol

The repository-root `AGENTS.md` is the canonical instruction entrypoint. `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and `.cursor/rules/` redirect supported assistants to this guide. These adapter files MUST remain concise and MUST NOT define conflicting architecture.

For every backend task, the assistant MUST:

1. Convert the request into observable HTTP, persistence, role/club-scope, statistics, and failure acceptance criteria.
2. Trace the complete code path and inspect DTOs, guards, entities, relations, repositories, providers, and tests it reaches.
3. Confirm behavior from code and domain docs; do not invent endpoints, tables, roles, metric definitions, or response fields.
4. Identify concurrency, rollback, not-found, conflict, forbidden, validation, and external-provider failure paths before coding.
5. Implement the smallest cohesive change and avoid unrelated module-wide cleanup.
6. Test the affected layer in isolation, then run integration/build checks proportional to risk.
7. Review the final diff for unrequested formatting, schema drift, secrets, generated files, stale docs, and missing migrations.
8. Report verification evidence and distinguish new failures from pre-existing failures.

Existing code is evidence of behavior, not permission to reproduce architectural debt. New code follows this guide; broader cleanup requires explicit scope.

## 3. NestJS Module Architecture

The repository separates foundational concerns under `src/core/`, product domains under `src/modules/`, and reusable infrastructure under `src/shared/`.

New or substantially expanded modules SHOULD follow this layout:

```text
src/modules/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── dto/
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   ├── query-<feature>.dto.ts
│   └── <feature>-response.dto.ts
├── entities/
│   ├── <feature>.entity.ts
│   └── <domain-value>.enum.ts
├── services/
│   ├── create-<feature>.service.ts
│   ├── get-<feature>.service.ts
│   ├── update-<feature>.service.ts
│   └── delete-<feature>.service.ts
├── repositories/
│   └── <feature>.repository.ts
└── providers/             # Feature-owned external integrations, if needed
```

Do not create empty directories. When creating or editing any module, services MUST ALWAYS be split into separate operation-focused files: `create-<feature>.service.ts`, `get-<feature>.service.ts`, `update-<feature>.service.ts`, and `delete-<feature>.service.ts`.

Every new NestJS module MUST:

- declare its controllers and providers;
- register TypeORM entities through `TypeOrmModule.forFeature(...)` when needed;
- export only providers required by another module;
- be imported by `src/app.module.ts` or a relevant parent module;
- avoid circular dependencies; `forwardRef` is a documented last resort, not a default.

## 4. Mandatory Layer Separation

### 4.1 Controllers: HTTP Transport Only

Controllers may:

- declare routes, status codes, guards, pipes, interceptors, input DTOs, and return types;
- extract route, query, body, file, and authenticated-user inputs;
- delegate one use case to a service.

Controllers MUST NOT:

- access TypeORM repositories or `DataSource` directly;
- implement business rules, club/child access policy, transaction logic, or response assembly loops;
- call AWS, Twilio, email, Google, or another external service directly;
- return unrestricted TypeORM entities when a response DTO exists.

Every public controller method MUST declare an explicit return type. Use NestJS pipes such as `ParseUUIDPipe` for transport-level validation.

### 4.2 Services: Business Rules and Orchestration

Services own use cases, permission decisions based on loaded data, workflow order, and transaction orchestration. They MUST delegate persistence to repositories and external I/O to providers.

- Services MUST NEVER manipulate the database or call TypeORM directly — they MUST ALWAYS delegate all database access and persistence operations to dedicated repositories.
- Services MUST ALWAYS be split into separate files per operation (`create`, `get`, `update`, `delete`) whenever creating or editing a module.
- Keep transactions around the smallest atomic set of writes.
- A service in module A MUST NEVER inject or call a repository from module B; cross-module interaction MUST ALWAYS consume module B's service contract.
- Do not hide business rules in controllers or entity lifecycle hooks.
- Return response DTOs or explicitly mapped domain results.
- Club-period, attendance, pagela, and accepted-Christ rules MUST be centralized and reusable rather than duplicated by endpoints.

### 4.3 Repositories: Persistence Only

Repositories own TypeORM access:

- `Repository<Entity>` operations;
- query builders, joins, pagination, sorting, and database filters;
- persistence-specific duplicate-key interpretation;
- methods accepting an optional `EntityManager` for transactions.

Repositories MUST NOT own HTTP concerns, user-facing presentation, role policy, notification delivery, or cross-domain workflow decisions. All query values MUST be parameterized. Dynamic sort fields MUST map through an allowlist.

### 4.4 Entities and DTOs

- Entities describe persistence and relations; they are not request or response DTOs.
- Every endpoint and use case MUST define explicit input DTOs (request body, query, params) and explicit output DTOs (response DTOs) for everything.
- Request DTOs use class-validator and class-transformer for conversion and nested validation.
- Response DTOs define the public contract and prevent exposure of internal columns or relation cycles.
- Update DTOs distinguish an omitted property from explicit `null` when nullability is supported.
- Never bind request bodies directly to entities or return unrestricted TypeORM entities.
- Paginated endpoints MUST return the shared paginated DTO shape instead of inventing feature-specific envelopes.

### 4.5 External Providers

AWS S3, SMTP, Twilio, Google authentication, and all third-party integrations MUST remain behind injectable providers in `src/shared/providers/` or a feature-owned `providers/` directory. Email content — subject, template and recipients — belongs to `src/shared/email/`, never to the transport or to a use case; see [`email.md`](email.md).

Providers own client configuration, timeouts, retries, vendor payloads, and error translation. Services consume typed, vendor-neutral methods. Tests MUST mock providers and MUST NOT call live services.

## 5. TypeScript, DTOs, Enums, and Validation

- NEVER use `any` under any circumstances. Use explicit types for everything; use `unknown` only for caught errors or untrusted payloads and narrow it immediately.
- Do not use type assertions merely to silence a contract mismatch.
- Public controller, service, repository, provider, and utility methods MUST declare return types.
- ALWAYS create dedicated files for `types` (e.g., `types.ts` or `dto/` files) and `constants` (`constants.ts`) — inline declaration of types, interfaces, magic numbers, or hardcoded config constants in controllers, services, repositories, or providers is strictly prohibited.
- ALWAYS use domain enums for roles, statuses, weekdays, attendance values, domain options, and all finite sets — magic strings are strictly prohibited across controllers, services, repositories, and DTOs.
- ALWAYS create dedicated `utils` / helper files for reusable pure functions, formatters, and data transformations instead of duplicating logic inline inside controllers, services, or repositories.
- Use DTOs for every input payload (body, query, parameters) and explicit output DTOs for every response without exception.
- Prefer `readonly` for injected dependencies and immutable data where appropriate.

The global `ValidationPipe` in `src/main.ts` uses transformation, whitelisting, and rejection of non-whitelisted fields. Every new DTO MUST be compatible with these settings. Nested DTOs require `@ValidateNested()` and `@Type(() => NestedDto)`.

```ts
export class QueryClubsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsString()
  searchString?: string;
}
```

## 6. Authentication and Authorization

- Use existing JWT guards and role/permission mechanisms. Do not parse or verify JWTs manually in controllers.
- Authentication proves identity; each use case must separately enforce role, assigned-club scope, and resource ownership.
- Admin, coordinator, and teacher access MUST use the same policy across list, detail, create, update, delete, and statistics endpoints.
- Never trust a client-provided actor ID when it is available from the authenticated request.
- Use a typed authenticated-request interface instead of repeated casts to `any`.
- Feature flags that protect capabilities must be enforced by the API, not only by the frontend.
- Return 401 for missing/invalid authentication and 403 for an authenticated actor without permission.

## 7. Error Contract and Observability

`docs/error-handling.md` and the implementations under `src/shared/exceptions/` are the source of truth.

- Throw the established application exception for known business, validation, authentication, authorization, conflict, and not-found failures.
- Do not throw a generic `Error` or raw TypeORM/vendor exception for a known domain condition.
- Preserve an existing application exception when catching it; do not replace its error code with a generic internal error.
- Wrap unknown infrastructure failures with the internal application exception and retain the original cause where supported.
- The global exception filter owns the standard `{ success: false, error: ... }` envelope. Controllers and services MUST NOT create competing shapes.
- Keep end-user messages appropriate for the existing Portuguese UI while code, types, and engineering documentation remain in English.
- Use NestJS `Logger` with module, operation, request/correlation ID, and safe resource identifiers.
- Never log JWTs, passwords, authorization headers, full request bodies containing personal data, children's data, guardian details, or uploaded file contents.
- Do not silently swallow exceptions. Recover deliberately, translate them, or rethrow them.

## 8. TypeORM, Transactions, and Schema Changes

- Keep database access in repositories.
- Use `DataSource.transaction(...)` or a `QueryRunner` for multi-write atomic operations.
- Every operation within a transaction MUST use its `EntityManager`; mixing global repositories with transactional ones breaks atomicity.
- Always release a manual `QueryRunner` in `finally` and roll back after a failed transaction.
- Avoid N+1 queries. Load relations intentionally and select only contract-required fields.
- Pagination MUST use bounded limits, deterministic ordering, and an accurate total.
- Database constraints and indexes must enforce concurrency-sensitive uniqueness and lookup rules.
- Derived statistics must document their filters, date boundaries, timezone assumptions, and access scope.

`AI_DATABASE_CHANGE_REQUIREMENTS.md` is authoritative for all entity and database schema changes.

Every schema migration MUST be generated automatically by the official TypeORM CLI/core through `typeorm migration:generate`, using the repository `DataSource` and the difference between registered entities and the current local schema. The migration file MUST NOT be created with an editor, `apply_patch`, copy/paste, raw SQL, an ad hoc script, or `typeorm migration:create`. Its generated contents MUST NOT be edited manually. If the output is wrong or unsafe, fix the entity metadata or `DataSource` configuration, remove the incorrect generated output, and run `migration:generate` again.

The current `DatabaseModule` uses `synchronize: true`, and the repository does not yet expose the required CLI `DataSource` and migration scripts. This is existing technical debt, not an allowed schema-change mechanism. Before the next schema-changing delivery, establish the TypeORM CLI infrastructure described in `AI_DATABASE_CHANGE_REQUIREMENTS.md`, set `synchronize: false`, and let TypeORM generate the migration.

Migration rules:

- Only the official TypeORM CLI/core `migration:generate` workflow may create a schema migration.
- Never use `migration:create` for a schema change and never manually create or edit a migration file.
- Never rely on `synchronize` to deploy or emulate a schema migration.
- Never change production tables manually through a console or ad hoc SQL.
- Never modify a migration that may already have run; change the entities and generate the next migration.
- Design data backfills and destructive changes as staged, recoverable operations.
- Do not run migrations against shared or production environments without explicit authorization.
- Entity/schema changes and the matching TypeORM-generated migration belong in the same delivery.

## 8.1 Uploaded Files and S3 Lifecycle

An object in S3 has no transaction. It is uploaded before the database write and
survives a rollback, so every flow that touches a file MUST follow these rules.

- **Never delete before writing.** On a replacement, upload the new file, save
  the media row, and only then delete the previous object. Deleting first leaves
  the media with no file at all when the upload fails.
- **Register every upload.** Use `S3UploadTracker` as the upload function of the
  operation and, in the `catch`, call
  `MediaItemProcessor.discardUnreferencedUploads(tracker.uploadedUrls, deleteFn)`.
  It deletes only the objects that no media row references, so a row that
  survived the failure keeps its file.
- **Delete the file whenever the row goes away.** Removing a page, a section or
  a media item MUST delete the S3 object of every item with `isLocalFile`.
  Gather the ids before removing the parent: a cascade erases the sections and
  with them the only way to find their media.
- **Only files of this bucket are deleted.** `AwsS3Service.extractKey` returns
  `null` for a link of another bucket or another host, and the deletion is
  skipped instead of failing.
- **A failed deletion never fails the request.** It is logged with the
  `ÓRFÃO NO S3` prefix so the object can be found later.
- **Replacing a set of media** goes through
  `MediaItemProcessor.cleanAndReplaceMediaItems`, which applies the same order:
  it uploads and saves first, then removes the rows that were not reused and the
  files no longer referenced. It matches the incoming item against the current
  one **by id first, then by url**, so an upload resent without a new file keeps
  the object already in S3. An upload item with neither a file nor a previous
  media is rejected — silently dropping it would delete the current media.
- **The `targetType` written and the one read MUST be the same string.** A
  mismatch hides the media from the read paths and leaves its file in the bucket
  forever when the target is deleted. Declare it once as a module constant and
  use that constant on both sides.
- `npm run s3:audit` compares the bucket against `media_items` and reports
  orphaned objects and media pointing to a missing file. It deletes nothing
  unless `--delete --confirm` is passed.

## 9. Privacy and Security

This system handles children's and families' data. Data minimization is mandatory.

- Collect, return, and log only fields required by the use case.
- Never expose password hashes, reset tokens, refresh tokens, internal notes, or hidden entity columns.
- Validate upload MIME type, extension, size, and ownership on the server.
- Do not trust filenames or client-provided storage keys.
- Keep secrets in environment configuration; never commit credentials or embed them in docs and tests.
- Parameterize queries and allowlist dynamic sort/filter fields.
- Preserve CORS, global validation, exception filtering, and other security behavior configured in `src/main.ts`.
- Avoid personal data in error details, analytics, dashboards, and third-party telemetry unless the documented feature requires an authorized aggregate.
- Statistics and exports MUST enforce the same access scope as source-record endpoints.

## 10. Testing and Coverage

Every behavior change MUST add or update tests in the same delivery.

- Controllers: guard/delegation behavior, valid input, invalid input, and response status/shape.
- Services: success, not found, conflict, forbidden, and relevant business-rule branches.
- Repositories: role/club filters, pagination, relation loading, transaction usage, and duplicate constraints.
- Statistics: exact fixtures for date ranges, inactive records, permissions, totals, and boundary cases.
- Providers: success, timeout, translated vendor error, and retry policy without live calls.
- Bug fixes: add a regression test that fails before the correction.

Use Jest, `@nestjs/testing`, and Supertest. Mock TypeORM repositories, `DataSource`, AWS, Twilio, email, time, and random values. Tests MUST NOT connect to real databases or external services.

New or changed modules should maintain at least 90% coverage in the affected scope, including meaningful branches. Keep tests deterministic and use a single worker unless parallel isolation has been proven.

## 11. API and Domain Documentation

When behavior or a contract changes, update every applicable artifact:

- the relevant `docs/api-*.md` or domain document;
- `docs/README.md` when navigation changes;
- `docs/implemented-rules.md` when a business rule changes;
- `docs/error-handling.md` when the error catalog or envelope changes;
- automation scripts, Postman assets, or examples that encode the previous contract.

Documentation examples MUST be checked against current DTOs, roles, status codes, and response envelopes.

### 11.1 Dependency Injection and Configuration

- NestJS providers are singleton by default. Never store request-specific mutable state on a service or repository instance.
- Constructor injection is mandatory for services, repositories, providers, `ConfigService`, and `DataSource`; avoid service locators and module-level mutable clients.
- Do not instantiate another service with `new`. Register and inject it through its module.
- Read environment values through `ConfigService`; avoid scattered direct `process.env` reads.
- Required variables must fail clearly during application startup, not on the first request that needs them.
- Environment defaults must be safe for local development and must never contain real credentials.
- Provider configuration stays inside the provider. Domain services do not know SDK initialization, secret names, or vendor-specific URLs.

### 11.2 API Compatibility, Pagination, and Idempotency

- Treat path, method, status code, request fields, response fields, nullability, enum values, sorting, and pagination metadata as public contract.
- Prefer additive compatible changes. Removing/renaming a field or changing its meaning requires an explicit deprecation plan and synchronized frontend/docs changes.
- Use shared pagination shapes, stable defaults, and a bounded maximum `limit`.
- Sorting accepts only documented allowlisted fields and directions.
- Create endpoints that may be retried need a natural unique constraint or explicit idempotency strategy when duplicates are harmful.
- `PATCH` updates only supplied fields. `PUT`, if used, must have documented replacement semantics.
- Do not reveal whether an out-of-scope club, child, pagela, or profile exists. Apply scope before forming not-found/forbidden details.

### 11.3 Statistics and Reporting Correctness

- Every metric must define numerator, denominator, included/excluded statuses, date field, timezone, and role/club scope.
- Use `[start, end)` time ranges when practical to prevent overlapping reporting periods.
- Do not mix local calendar dates with UTC timestamps without an explicit conversion rule.
- Counts over joined relations must prevent duplicate rows, commonly through `COUNT(DISTINCT ...)` or a proven equivalent.
- Empty data, zero, unavailable data, and permission-filtered data are different states and must not be conflated.
- Rankings need deterministic tie-breaking and a documented limit.
- Statistics endpoints must use database aggregation rather than loading unbounded records into Node.js.
- Any formula or filter change requires exact fixture-based regression tests and an update to `docs/api-statistics.md` or the applicable review document.

### 11.4 Uploads, Asynchronous Work, and Concurrency

- Validate upload count, declared MIME type, detected content type where feasible, extension, and size before provider upload.
- Generate storage keys on the server. Never trust a client path, filename, bucket, or ownership field.
- If database persistence fails after upload, compensate by deleting the object or record the cleanup for a reliable retry.
- Do not start untracked fire-and-forget promises from a request. Await critical work or hand it to an established durable job mechanism.
- Every deliberately detached promise must handle and log rejection without sensitive data.
- Use database uniqueness and foreign-key constraints for concurrency-sensitive rules and translate their violations into documented errors.
- Avoid read-then-write assumptions without a constraint, lock, or transaction when concurrent requests can break the invariant.

### 11.5 NestJS Unit Test Blueprint

```ts
import { Test } from '@nestjs/testing';

describe('CreateClubsService', () => {
  const clubsRepository = {
    createClub: jest.fn(),
  };
  const authContext = {
    tryGetPayload: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('delegates persistence and returns the created club', async () => {
    authContext.tryGetPayload.mockResolvedValue({ role: 'admin', sub: 'user-id' });
    clubsRepository.createClub.mockResolvedValue({
      id: 'club-id',
      number: 12,
      isActive: true,
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateClubsService,
        { provide: ClubsRepository, useValue: clubsRepository },
        { provide: AuthContextService, useValue: authContext },
      ],
    }).compile();

    const service = moduleRef.get(CreateClubsService);
    await expect(service.create(validDto, authenticatedRequest)).resolves.toMatchObject({
      id: 'club-id',
    });
    expect(clubsRepository.createClub).toHaveBeenCalledTimes(1);
  });
});
```

Provide all real constructor dependencies in the test module, including authorization/context collaborators. Use builders for valid DTOs and override only fields relevant to each test. Avoid shared mutable fixtures.

## 12. Verification Commands

Run from `clubinhonib-api`:

```bash
NODE_OPTIONS='--max-old-space-size=2048' npm run build
NODE_OPTIONS='--max-old-space-size=2048' npm test -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run test:cov -- --runInBand
NODE_OPTIONS='--max-old-space-size=2048' npm run lint
```

The current lint script applies fixes. Inspect the diff afterward and revert no unrelated user changes. During implementation, focused Jest paths are preferred; before delivery, run checks proportional to the affected scope.

## 13. Definition of Done

A backend change is complete only when:

- NestJS layer boundaries and public contracts are respected;
- authentication, club scope, validation, and privacy paths are covered;
- schema changes include a reviewed migration generated by the official TypeORM CLI/core, with no manual creation or edits;
- application errors preserve the standardized envelope and code;
- relevant tests and documentation were updated;
- build, tests, coverage, and lint checks pass for the affected scope;
- no new `any`, sensitive logging, live-service test, or unrelated diff was introduced.
