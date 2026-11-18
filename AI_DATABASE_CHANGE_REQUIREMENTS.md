# AI Database Change Requirements — Clubinho NIB API

## Hard Rule

Every database schema migration MUST be generated automatically by the TypeORM CLI/core from the difference between the registered entities and the current local schema.

The migration file MUST originate from `typeorm migration:generate`. Creating it with an editor, `apply_patch`, copy/paste, an ad hoc script, raw SQL, or `typeorm migration:create` is prohibited for schema changes. Manually editing the generated migration is also prohibited.

## Repository Status

The migration infrastructure now exists and has been validated:

| Piece | Where |
| --- | --- |
| CLI `DataSource` | `src/database/data-source.ts` |
| Entity list shared by app and CLI | `src/database/entities.ts` |
| Versioned migration output | `src/database/migrations/` |
| `synchronize` | `false` by default; `DB_SYNCHRONIZE=true` opts in and logs a warning |
| Local commands | `db:local:migration:generate`, `db:local:migration:deploy`, `db:local:migration:status`, `db:local:migration:revert` |
| Disposable-database guard | the `DataSource` refuses a non-local `DB_HOST` unless `DB_MIGRATION_ALLOW_REMOTE=true` |

The entity list lives in `src/database/entities.ts` and is imported by both the
application module and the CLI `DataSource`: generating from a different set
than the application registers would produce an invented diff.
`src/app.module.spec.ts` fails if an `@Entity` class is missing from that list.

There is no baseline migration. When the infrastructure was set up,
`migration:generate` reported *"No changes in database schema were found"* — the
schema built by the old `synchronize: true` already matched the entities
exactly. Environments created before this point already have the schema, so the
first versioned migration is the first real change after it.

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

## Database Schema Diagrams (PlantUML)

Whenever entities, relationships, or table schemas are added or modified:

1. Update or create the corresponding PlantUML database schema diagram `.puml` file under `docs/diagrams/database/` (e.g. `docs/diagrams/database/database-schema.puml`).
2. Immediately render the updated `.png` image file using `npm run diagrams:generate` or `node scripts/generate-diagrams.js`.
3. Verify that both the `.puml` source file and the rendered `.png` image file are committed together alongside the database entities and migration.

If the current change does not alter entities, relationships, or table schemas,
leave existing database diagrams untouched and do not create missing diagrams as
unrelated backfill.
