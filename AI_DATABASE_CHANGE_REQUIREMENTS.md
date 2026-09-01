# AI Database Change Requirements — Clubinho NIB API

## Hard Rule

Every database schema migration MUST be generated automatically by the TypeORM CLI/core from the difference between the registered entities and the current local schema.

The migration file MUST originate from `typeorm migration:generate`. Creating it with an editor, `apply_patch`, copy/paste, an ad hoc script, raw SQL, or `typeorm migration:create` is prohibited for schema changes. Manually editing the generated migration is also prohibited.

## Current Repository Gap

The repository currently uses `synchronize: true` and does not expose a complete TypeORM CLI migration workflow. This is existing technical debt, not an allowed schema-change mechanism.

Before the next schema-changing delivery, the implementation MUST first establish and validate:

- a TypeORM CLI `DataSource` using the same entity metadata and naming behavior as the application;
- `synchronize: false` for controlled environments;
- a versioned migration output directory;
- local commands for `migration:generate`, `migration:run`, and `migration:show`/status;
- environment loading that points generation at a disposable/local database only.

No entity/schema change is complete until this infrastructure exists and TypeORM itself has generated the migration.

## Required Workflow

1. Start from a local database whose migration status is current.
2. Change TypeORM entities or database metadata.
3. Run the repository's TypeORM generation command, following this contract:

```bash
npm run db:local:migration:generate -- src/database/migrations/DescriptiveMigrationName
```

4. Review the generated file without modifying it.
5. If the generated SQL is wrong or unsafe, fix the entity/DataSource configuration, discard the generated output, and run `migration:generate` again.
6. Apply the generated migration to the local database:

```bash
npm run db:local:migration:deploy
```

7. Verify migration status:

```bash
npm run db:local:migration:status
```

8. Run the build and relevant tests.
9. Deliver entity/database code and the TypeORM-generated migration together.

The exact scripts may be added during the initial migration-infrastructure delivery, but they MUST invoke the official TypeORM CLI with the repository `DataSource`.

## Prohibited Actions

- Do not create a migration file manually.
- Do not use `typeorm migration:create` for a schema change.
- Do not edit the contents of a generated schema migration.
- Do not use `synchronize: true` to deploy or emulate a migration.
- Do not alter tables manually in MySQL, a cloud console, or an ad hoc script.
- Do not generate against staging or production.
- Do not run a migration against staging or production without explicit authorization.
- Do not modify a migration that may already have run.
- Do not deliver entity metadata changes without the matching TypeORM-generated migration.

## Review Checklist

The generated output must be reviewed for:

- unexpected table or column drops;
- destructive type/nullability/default changes;
- missing foreign keys, unique constraints, and indexes;
- accidental renames interpreted as drop-and-create operations;
- unsafe data loss or table-wide locks;
- consistency with MySQL and the application `DataSource`.

Review does not authorize manual editing. Correct the source metadata and regenerate.
