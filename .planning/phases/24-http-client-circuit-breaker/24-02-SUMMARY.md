---
phase: 24-http-client-circuit-breaker
plan: 02
subsystem: contracts + config (external API type namespaces + env schemas)
tags: [contracts, config, zod, external-apis, telegram, appstorespy, cloud-functions]
requires:
  - 24-01 (HTTP framework + HttpCallOpts naming — foundation primitives)
  - packages/config compose pattern (Phase 20 composeSchemas)
  - packages/contracts barrel conventions (namespace re-exports)
provides:
  - packages/contracts/src/external/telegram (SendMessageRequest, SendMessageResponse, TelegramMessage)
  - packages/contracts/src/external/appstorespy (LookupAppRequest, LookupAppResponse, AppMetadata)
  - packages/contracts/src/external/cloud-functions (SendEmailRequest, SendEmailResponse)
  - packages/config TelegramSchema/AppStoreSpySchema/CloudFnSchema + matching types
  - 6 new env vars: TELEGRAM_BOT_TOKEN, TELEGRAM_BASE_URL, APPSTORESPY_API_KEY, APPSTORESPY_BASE_URL, CLOUDFN_API_KEY, CLOUDFN_BASE_URL
affects:
  - apps/notifier env (now requires TELEGRAM_*)
  - apps/parser env (now requires APPSTORESPY_*)
  - apps/sender env (now requires CLOUDFN_*)
tech-stack:
  added: []
  patterns:
    - Contracts `external/` directory symmetric with `generated/` (D-02)
    - Namespace re-exports (`export * as TelegramTypes ...`) on contracts barrel
    - Zod sub-schemas composed into per-service env via `composeSchemas(...)`
key-files:
  created:
    - packages/contracts/src/external/telegram/types.ts
    - packages/contracts/src/external/telegram/index.ts
    - packages/contracts/src/external/appstorespy/types.ts
    - packages/contracts/src/external/appstorespy/index.ts
    - packages/contracts/src/external/cloud-functions/types.ts
    - packages/contracts/src/external/cloud-functions/index.ts
    - packages/config/src/schemas/external-apis.ts
  modified:
    - packages/contracts/src/index.ts
    - packages/config/src/schemas/index.ts
    - apps/notifier/src/infrastructure/config/notifier-env.schema.ts
    - apps/parser/src/infrastructure/config/parser-env.schema.ts
    - apps/sender/src/infrastructure/config/sender-env.schema.ts
    - .env.example
    - .env.docker
decisions:
  - D-02 realised: external API types live in `packages/contracts/src/external/`, symmetric with `generated/`
  - D-18 realised: skeleton type shapes only (1–2 types per API), full surface deferred
  - D-19 realised: no `.default()`, no `.optional()`, no `z.coerce.boolean()` — every var required
metrics:
  duration: 108s
  completed: 2026-04-15T08:03:41Z
---

# Phase 24 Plan 02: External API Contracts + Env Extensions Summary

**One-liner:** Added skeleton type namespaces (Telegram/AppStoreSpy/CloudFn) under `packages/contracts/src/external/` and wired three new Zod env sub-schemas through per-service compositions — HTTP-03 adapter work in Plan 24-03 can now `import` typed request/response + config with zero per-API knowledge in foundation.

## Objective Achieved

Plan 24-01 delivered the HTTP framework primitives with zero per-API knowledge. This plan supplies the two remaining surfaces adapters need:

1. **Typed contracts** — `SendMessageRequest/Response`, `LookupAppRequest/Response`, `SendEmailRequest/Response` (skeleton per D-18) in the contracts package.
2. **Validated config** — per-service env schemas extended with one sub-schema each (notifier→Telegram, parser→AppStoreSpy, sender→CloudFn) and placeholder env vars in both `.env.example` and `.env.docker`.

## Tasks Executed

### Task 1: Contracts `external/` namespaces (commit `2724ffb`)

Created 6 files symmetric with `packages/contracts/src/generated/`:

```
packages/contracts/src/external/
  telegram/          → SendMessageRequest, TelegramMessage, SendMessageResponse
  appstorespy/       → LookupAppRequest, AppMetadata, LookupAppResponse
  cloud-functions/   → SendEmailRequest, SendEmailResponse
```

Barrel updated (`packages/contracts/src/index.ts`):

```typescript
export * as TelegramTypes from './external/telegram';
export * as AppStoreSpyTypes from './external/appstorespy';
export * as CloudFnTypes from './external/cloud-functions';
```

**Generate-pipeline safety verified:** `packages/contracts/scripts/generate.sh` only writes to `src/generated/` (explicit `OUT_DIR="$SCRIPT_DIR/../src/generated"`, `rm -rf "$OUT_DIR"`). Root `turbo.json` `generate` task has `outputs: ["src/generated/**"]` — confirmed via grep that no `src/external` mentions exist anywhere in generator scripts/turbo configs. `src/external/` is safe from clobber.

Build: `pnpm --filter @email-platform/contracts build` — green.

### Task 2: Env sub-schema + per-service composition + `.env` placeholders (commit `382fc1f`)

**New file** `packages/config/src/schemas/external-apis.ts`:

```typescript
export const TelegramSchema    = z.object({ TELEGRAM_BOT_TOKEN:    z.string().min(1), TELEGRAM_BASE_URL:    z.string().url() });
export const AppStoreSpySchema = z.object({ APPSTORESPY_API_KEY:   z.string().min(1), APPSTORESPY_BASE_URL: z.string().url() });
export const CloudFnSchema     = z.object({ CLOUDFN_API_KEY:       z.string().min(1), CLOUDFN_BASE_URL:     z.string().url() });
```

No `.default()`, no `.optional()`, no `z.coerce.boolean()` — enforced by D-19 + env-schema skill.

**Barrel updated** (`packages/config/src/schemas/index.ts`) — 3 schemas + 3 types re-exported.

**Per-service compositions (before → after):**

| Service  | Before                                                      | After                                                                    |
|----------|-------------------------------------------------------------|--------------------------------------------------------------------------|
| notifier | Topology + Rabbit + Storage + Logging + Grpc                | Topology + Rabbit + Storage + Logging + Grpc + **Telegram**              |
| parser   | Topology + Database + Storage + Logging + Grpc              | Topology + Database + Storage + Logging + Grpc + **AppStoreSpy**         |
| sender   | Topology + Database + Redis + Logging + Grpc                | Topology + Database + Redis + Logging + Grpc + **CloudFn**               |

No cross-contamination — each service composes exactly ONE external-API sub-schema matching its adapter responsibility.

**Env file additions** (both `.env.example` and `.env.docker` — grep proof below, all placeholders):

```
TELEGRAM_BOT_TOKEN=replace-me-telegram-bot-token
TELEGRAM_BASE_URL=https://api.telegram.org
APPSTORESPY_API_KEY=replace-me-appstorespy-api-key
APPSTORESPY_BASE_URL=https://api.appstorespy.com
CLOUDFN_API_KEY=replace-me-cloudfn-api-key
CLOUDFN_BASE_URL=https://us-central1-example.cloudfunctions.net
```

Grep proof (`.env.example` + `.env.docker`): all 6 vars present in both files with placeholder values, section-commented as "Phase 24 External APIs".

**Threat mitigations realised:**
- T-24-06 (committed secrets): placeholder values `replace-me-*` only; real tokens injected at deploy by operator/Coolify.
- T-24-07 (missing validation): Zod rejects undefined at service boot — confirmed by `grep .default/.optional → 0 hits`.
- T-24-08 (empty tokens/malformed URLs): `.min(1)` on all token/key fields, `.url()` on all base-URL fields.

Full workspace build: `pnpm build` — 10/10 tasks successful.

## Deviations from Plan

None — plan executed exactly as written.

## Verification Results

| Check                                                          | Result |
|----------------------------------------------------------------|--------|
| `pnpm --filter @email-platform/contracts build`                | exit 0 |
| `pnpm build` (workspace)                                       | 10/10 successful |
| Namespace exports in contracts barrel                          | 3 (TelegramTypes / AppStoreSpyTypes / CloudFnTypes) |
| `src/external` refs in generate.sh / turbo.json                | 0 (pipeline safe) |
| 6 env keys in `.env.example`                                   | 6/6 present |
| 6 env keys in `.env.docker`                                    | 6/6 present |
| `.default(` / `.optional(` in external-apis.ts + service schemas | 0 hits |

## Self-Check: PASSED

Files verified on disk:
- FOUND: packages/contracts/src/external/telegram/types.ts
- FOUND: packages/contracts/src/external/telegram/index.ts
- FOUND: packages/contracts/src/external/appstorespy/types.ts
- FOUND: packages/contracts/src/external/appstorespy/index.ts
- FOUND: packages/contracts/src/external/cloud-functions/types.ts
- FOUND: packages/contracts/src/external/cloud-functions/index.ts
- FOUND: packages/config/src/schemas/external-apis.ts

Commits verified in git log:
- FOUND: 2724ffb (Task 1 — contracts external types)
- FOUND: 382fc1f (Task 2 — env sub-schema + per-service compositions + .env placeholders)
