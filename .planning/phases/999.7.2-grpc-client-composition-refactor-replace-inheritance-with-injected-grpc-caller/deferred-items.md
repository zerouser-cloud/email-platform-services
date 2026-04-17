# Deferred Items — Phase 999.7.2

Out-of-scope discoveries from Plan 03a execution. Not fixed here.

## From Wave 2 (Plan 02) leftovers

- **apps/gateway/src/infrastructure/clients/auth/auth.client.ts** — 2 prettier/prettier errors (lines 9, 10): constructor/getService formatting. Wave 2 merged without `lint:fix`. Pre-existing before Plan 03a; not caused by Task 1. Should be picked up by Plan 04 ESLint guard sweep or a `/gsd:fast` docs/lint cleanup.

## From Plan 04 (Wave 5) discoveries

- **packages/config/src/compose.ts:9** — `@typescript-eslint/ban-types` error on `{}` type usage. Discovered when running direct `pnpm exec eslint 'packages/*/src/**/*.ts'` during Task 3 post-append verification. NOT caught by `pnpm lint` (Turbo) because `packages/config` has no `lint` script in package.json. Completely unrelated to Plan 04 (AbstractGrpcClient removal + skill doc + ESLint Override 6 append). Pre-existing; out of scope. Follow-up: a `/gsd:fast` pass to either (a) replace `{}` with `Record<string, never>`/`object`/`unknown` as linter suggests, or (b) add a `lint` script to `packages/*/package.json` so Turbo catches these on every run.
- **packages/config/src/env-schema.ts:1** — unused `z` import warning (same discovery context). Out of scope.
