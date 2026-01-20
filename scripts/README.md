# Population and Test Scripts

Raw JavaScript scripts to populate the API and run E2E tests.

## Prerequisites

1. API running on `localhost:3000`
2. User `superuser@clubinhonib.com` with password `Abc@123` must exist
3. Node.js installed (v18+)

## Available Scripts

### 1. Automation Suite

The main entry point for running all automations is:

```bash
node scripts/run-all-testes.js
```

This runs the checks defined in `scripts/automations/`.

> **See full guide:** [Automation Checklist](../docs/automation-checklist.md)

### 2. Global Population (Legacy/specific)

```bash
node scripts/create-pagelas-2026.js
```

## Folder Structure

- `automations/`: Contains specific test/fix scripts for each module.
- `run-all-testes.js`: Orchestrator to run all automations.

## Notes

- Scripts are independent and can be executed separately.
- **Warning**: Creates real data in the database. Use with caution in production.
