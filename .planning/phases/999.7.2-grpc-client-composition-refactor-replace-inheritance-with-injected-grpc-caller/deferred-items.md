# Deferred Items — Phase 999.7.2

Out-of-scope discoveries from Plan 03a execution. Not fixed here.

## From Wave 2 (Plan 02) leftovers

- **apps/gateway/src/infrastructure/clients/auth/auth.client.ts** — 2 prettier/prettier errors (lines 9, 10): constructor/getService formatting. Wave 2 merged without `lint:fix`. Pre-existing before Plan 03a; not caused by Task 1. Should be picked up by Plan 04 ESLint guard sweep or a `/gsd:fast` docs/lint cleanup.
