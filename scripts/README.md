# Population and Test Scripts

Raw JavaScript scripts to populate a running API with realistic data and
exercise every endpoint contract (happy path, validations and role scopes).

## Prerequisites

1. API running on `localhost:3000` (`npm run start:local`)
2. Node.js 18+ (uses the native `fetch`/`FormData`)
3. The superuser `superuser@clubinhonib.com` / `Abc@123`. Against a **local**
   database the suite creates it by itself when the login fails
   (`scripts/automations/bootstrap/seed-superuser.js`, reading `env/local.env`).

## Available Scripts

### Automation suite

```bash
node scripts/run-all-testes.js                 # everything, in dependency order
node scripts/run-all-testes.js clubs pagelas   # only the steps whose name starts with these prefixes
npm run automation:seed-superuser              # only seed the superuser in the local DB
```

Each module under `scripts/automations/<module>/` has a `create.js` (population)
and a `list-fix.js` (traverse every page, validate the contract and fix what the
API allows fixing). The run ends with `RESUMO ok=… warn=… fail=…` and exits with
`1` when any scenario failed.

> **Full guide (variables, fixed users per role, fixtures, coverage per controller):**
> [Automation Checklist](../docs/automation-checklist.md)

### Other scripts

- `scripts/create-pagelas-2026.js` — legacy pagela population.
- `scripts/s3/audit-orphans.js` — S3 orphan audit (`npm run s3:audit`).
- `scripts/email/preview.ts` — e-mail template preview (`npm run email:preview`).
- `scripts/deploy-ecs-prod.sh` — production deploy.

## Folder Structure

- `automations/common/` — config, HTTP client with per-role sessions, pagination
  reader, multipart helper, media payload builders, real-file fixtures generator.
- `automations/fixtures/` — small encoded fixtures (MP4, MP3, JPG) used by the uploads.
- `automations/bootstrap/` — superuser seed for the local database.
- `automations/<module>/` — `create.js` + `list-fix.js` per controller.
- `automations/run-all.js` — orchestrator; `run-all-testes.js` — CLI entry point.

## Notes

- Scripts are independent and can be executed separately through the prefix filter.
- **Warning**: they create real data (and real S3 objects) — never point them at production.
