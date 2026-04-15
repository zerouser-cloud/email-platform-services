---
phase: 24-http-client-circuit-breaker
plan: 03
subsystem: apps/{notifier,parser,sender}/infrastructure/clients — external HTTP adapters
tags: [http-client, adapters, telegram, appstorespy, cloud-functions, circuit-breaker, skeleton]
requires:
  - 24-01 (AbstractHttpClient + HTTP_CLIENT_DEFAULTS + HttpCallOpts + CB factory)
  - 24-02 (contracts external types + per-service env schemas)
provides:
  - apps/notifier TelegramClient + TelegramClientModule + TelegramNotificationAdapter
  - apps/parser AppStoreSpyClient + AppStoreSpyClientModule
  - apps/sender CloudFnClient + CloudFnClientModule
  - 3 smoke controllers (notifier/parser/sender)
  - VALIDATION.md frontmatter flipped (nyquist_compliant, wave_0_complete)
affects:
  - apps/notifier/src/notifier.module.ts (NOTIFICATION_SENDER_PORT rebind)
  - apps/parser/src/parser.module.ts (+AppStoreSpyClientModule)
  - apps/sender/src/sender.module.ts (+CloudFnClientModule)
  - apps/notifier/src/infrastructure/external (directory removed — stub gone)
tech-stack:
  added: []
  patterns:
    - "Per-service external-API adapter lives at apps/{service}/src/infrastructure/clients/{api}/"
    - "4-file scaffold: *-client.constants.ts (DI token + env keys + paths), *.client.ts (extends AbstractHttpClient), *.module.ts (forRoot DynamicModule wiring ConfigService + ClsService), index.ts barrel"
    - "DI tokens via Symbol.for() (D-20) — cross-module stable identity"
    - "Each adapter has its own opossum CB (D-08 isolation) via AbstractHttpClient constructor cbOptions"
    - "Smoke controllers mirror Phase 22.3 storage-smoke REST pattern, one POST endpoint per adapter"
key-files:
  created:
    - apps/notifier/src/infrastructure/clients/telegram/telegram-client.constants.ts
    - apps/notifier/src/infrastructure/clients/telegram/telegram.client.ts
    - apps/notifier/src/infrastructure/clients/telegram/telegram.module.ts
    - apps/notifier/src/infrastructure/clients/telegram/telegram-notification.adapter.ts
    - apps/notifier/src/infrastructure/clients/telegram/index.ts
    - apps/notifier/src/test/telegram-smoke.controller.ts
    - apps/parser/src/infrastructure/clients/appstorespy/appstorespy-client.constants.ts
    - apps/parser/src/infrastructure/clients/appstorespy/appstorespy.client.ts
    - apps/parser/src/infrastructure/clients/appstorespy/appstorespy.module.ts
    - apps/parser/src/infrastructure/clients/appstorespy/index.ts
    - apps/parser/src/test/appstorespy-smoke.controller.ts
    - apps/sender/src/infrastructure/clients/cloud-functions/cloudfn-client.constants.ts
    - apps/sender/src/infrastructure/clients/cloud-functions/cloudfn.client.ts
    - apps/sender/src/infrastructure/clients/cloud-functions/cloudfn.module.ts
    - apps/sender/src/infrastructure/clients/cloud-functions/index.ts
    - apps/sender/src/test/cloudfn-smoke.controller.ts
  modified:
    - apps/notifier/src/notifier.module.ts
    - apps/parser/src/parser.module.ts
    - apps/sender/src/sender.module.ts
    - .planning/phases/24-http-client-circuit-breaker/24-VALIDATION.md
  deleted:
    - apps/notifier/src/infrastructure/external/telegram-notification.sender.ts
    - apps/notifier/src/infrastructure/external/ (empty directory removed)
decisions:
  - "D-03 realised: 3 per-service adapters, each in its service's infrastructure/clients/{api}/ directory"
  - "D-08 realised: each adapter has an isolated opossum CB instance (created in AbstractHttpClient.onModuleInit)"
  - "D-10 realised: Telegram/CloudFn POSTs NOT flagged idempotent — single-shot; AppStoreSpy GET uses default retry"
  - "D-13 realised: zero Telegram/AppStoreSpy/CloudFn/opossum references in any service health/ directory — verified by grep"
  - "D-18 realised: 1 skeleton method per adapter (sendMessage/getAppMetadata/sendEmail); business-logic surface deferred"
  - "D-20 realised: Symbol.for('TELEGRAM_CLIENT'/'APPSTORESPY_CLIENT'/'CLOUDFN_CLIENT') for all 3 DI tokens"
  - "HTTP-04 realised: opossum/CircuitBreaker absent from packages/foundation/src/external/grpc and from gateway/audience/auth apps — grep 0 hits"
  - "Notifier domain-to-Telegram translation: adapter treats notification.payload as JSON envelope { chat_id, text } (skeleton) — full domain routing deferred"
metrics:
  duration: ~10min (tasks 1+2 executor autonomous)
  completed_date: 2026-04-15
  tasks_completed: 2
  tasks_pending: 1
  files_created: 16
  files_modified: 4
  files_deleted: 1
  commits: 4
---

# Phase 24 Plan 03: Per-Service HTTP Adapters — Summary (Tasks 1+2 complete, Task 3 pending human verify)

**One-liner:** Shipped 3 typed HTTP adapters (Telegram/AppStoreSpy/CloudFn) each extending the 24-01 AbstractHttpClient base, wired into notifier/parser/sender root modules via forRoot() DynamicModules, migrated the notifier's stub `TelegramNotificationSender` to a new `TelegramNotificationAdapter` that delegates to `TelegramClient`, and scaffolded 3 REST smoke controllers for operator verification.

## Files Created (16 files)

### Telegram (notifier, 6 files)
| File | Purpose |
|------|---------|
| `telegram-client.constants.ts` | `TELEGRAM_CLIENT` (Symbol.for), env keys, path, auth-header prefix, log context |
| `telegram.client.ts` | `TelegramClient extends AbstractHttpClient` with `sendMessage()` skeleton (POST, no idempotent per D-10) |
| `telegram.module.ts` | `TelegramClientModule.forRoot()` — injects ConfigService + ClsService, constructs client with `HTTP_CLIENT_DEFAULTS` |
| `telegram-notification.adapter.ts` | `implements NotificationSenderPort`; parses `notification.payload` as `{chat_id,text}` envelope, delegates to `TelegramClient.sendMessage()` |
| `index.ts` | Barrel — exports client, module, adapter, DI token |
| `test/telegram-smoke.controller.ts` | REST `POST /test/telegram/send` |

### AppStoreSpy (parser, 5 files)
| File | Purpose |
|------|---------|
| `appstorespy-client.constants.ts` | `APPSTORESPY_CLIENT` (Symbol.for), env keys, path, query keys, auth-header prefix, log context |
| `appstorespy.client.ts` | `AppStoreSpyClient extends AbstractHttpClient` with `getAppMetadata()` skeleton (GET, default retry per D-10) |
| `appstorespy.module.ts` | `AppStoreSpyClientModule.forRoot()` |
| `index.ts` | Barrel |
| `test/appstorespy-smoke.controller.ts` | REST `POST /test/appstorespy/lookup` |

### CloudFn (sender, 5 files)
| File | Purpose |
|------|---------|
| `cloudfn-client.constants.ts` | `CLOUDFN_CLIENT` (Symbol.for), env keys, path, auth-header prefix, log context |
| `cloudfn.client.ts` | `CloudFnClient extends AbstractHttpClient` with `sendEmail()` skeleton (POST, no idempotent per D-10) |
| `cloudfn.module.ts` | `CloudFnClientModule.forRoot()` |
| `index.ts` | Barrel |
| `test/cloudfn-smoke.controller.ts` | REST `POST /test/cloudfn/send` |

## Notifier Stub Migration

**Deleted:** `apps/notifier/src/infrastructure/external/telegram-notification.sender.ts` (10 lines, threw NotImplementedException) and the now-empty `external/` directory.

**Replaced by:** `TelegramNotificationAdapter` bound to `NOTIFICATION_SENDER_PORT` in `notifier.module.ts`:

```diff
-{ provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationSender }
+{ provide: NOTIFICATION_SENDER_PORT, useClass: TelegramNotificationAdapter }
```

Imports updated: `TelegramClientModule.forRoot()` added to `imports`; `TelegramSmokeController` added to `controllers`.

## Audit Proofs

### HTTP-04 isolation (CB stays in HTTP layer)
```bash
$ grep -rn "opossum|CircuitBreaker" packages/foundation/src/external/grpc apps/gateway/src apps/audience/src apps/auth/src
(zero hits)
```

### D-13 isolation (external APIs not in /health/ready)
```bash
$ grep -rn "TELEGRAM|APPSTORESPY|CLOUDFN|opossum|CircuitBreaker" apps/notifier/src/health/ apps/parser/src/health/ apps/sender/src/health/
(zero hits)
```

### D-20 (Symbol.for only, no bare Symbol())
```bash
$ grep -rn "Symbol.for" apps/{notifier,parser,sender}/src/infrastructure/clients/ | wc -l
4   # (3 client tokens + 1 re-export)
$ grep -rEn "Symbol\([^.]" apps/{notifier,parser,sender}/src/infrastructure/clients/
(zero hits — no bare Symbol(...) calls)
```

### AbstractHttpClient extensions
```bash
$ grep -l "extends AbstractHttpClient" apps/*/src/infrastructure/clients/*/*.client.ts | wc -l
3
```

### Adapter + smoke count
```bash
$ find apps -path '*/clients/*' -name '*.client.ts'
apps/notifier/src/infrastructure/clients/telegram/telegram.client.ts
apps/parser/src/infrastructure/clients/appstorespy/appstorespy.client.ts
apps/sender/src/infrastructure/clients/cloud-functions/cloudfn.client.ts

$ find apps -path '*/test/*-smoke.controller.ts' | grep -E "telegram|appstorespy|cloudfn"
apps/notifier/src/test/telegram-smoke.controller.ts
apps/parser/src/test/appstorespy-smoke.controller.ts
apps/sender/src/test/cloudfn-smoke.controller.ts
```

## VALIDATION.md Flip

**Frontmatter before/after:**
```diff
-nyquist_compliant: false
-wave_0_complete: false
+nyquist_compliant: true
+wave_0_complete: true
```

Per-task map: every row now has explicit Plan (24-01 / 24-02 / 24-03) + Wave (1/2/3). Manual-only rows remain `⬜ pending (manual)` — flip to `✅ green` during Task 3 human verify. All 6 Validation Sign-Off bullets checked.

## Build + Lint

```
pnpm build:  10 / 10 tasks successful (turbo, 2.35s)
pnpm lint:   7 / 7 tasks successful; 0 errors, 2 pre-existing warnings in
             apps/notifier/src/infrastructure/messaging/rabbitmq-event.subscriber.ts
             (unused eventType/payload params — not part of this plan's scope)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Contracts barrel exports `CloudFnTypes`, plan frontmatter hinted `CloudFunctionsTypes`**
- **Found during:** Task 2b (sender adapter authoring)
- **Issue:** Plan task text referenced `CloudFunctionsTypes` in one spot but 24-02 SUMMARY + actual `packages/contracts/src/index.ts` barrel exports the namespace as `CloudFnTypes`.
- **Fix:** Used `CloudFnTypes` (the actual exported name). No contracts change needed.
- **Commit:** `bb27f9d`

**2. [Rule 1 — Bug] Notifier `Notification` entity has no `recipient` / `message` fields**
- **Found during:** Task 1 (telegram-notification.adapter.ts authoring)
- **Issue:** Plan sample code referenced `notification.recipient` / `notification.message`, but the actual `apps/notifier/src/domain/entities/notification.entity.ts` exposes `(id, eventType, payload, sentAt)`.
- **Fix:** Adapter treats `notification.payload` as a JSON envelope `{chat_id, text}` — a skeleton translation consistent with D-18 (full domain routing deferred). The adapter compiles against the real entity shape.
- **Documented:** JSDoc on adapter class calls out the envelope convention and the deferred domain-routing work.
- **Commit:** `efc0168`

**3. [Rule 3 — Blocking] Prettier single-line formatting on arrow-return method signatures**
- **Found during:** `pnpm lint` post-Task 2
- **Issue:** Sender lint failed with 2 `prettier/prettier` errors on multi-line signatures that fit on a single line.
- **Fix:** Ran `eslint --fix` across sender/parser/notifier. 5 files reformatted; semantics unchanged.
- **Commit:** `1d7d46b`

### Auth Gates

None. No vendor credentials required during Tasks 1-2 (all construction paths are DI factory wiring with placeholder env values from 24-02).

## Commits

| # | Hash | Scope | Summary |
|---|------|-------|---------|
| 1 | `efc0168` | Task 1 | Telegram adapter + module + smoke; notifier stub migration |
| 2 | `dc63610` | Task 2a | AppStoreSpy adapter + module + smoke + parser.module wiring |
| 3 | `bb27f9d` | Task 2b | CloudFn adapter + module + smoke + sender.module wiring |
| 4 | `1d7d46b` | Task 2c | VALIDATION.md nyquist flip + lint autofixes |

## Known Stubs (Expected — D-18)

Each adapter ships 1 skeleton method. These are intentionally minimal and will be extended in the business-logic phase:
- `TelegramClient.sendMessage` — covers only the `sendMessage` endpoint; `editMessage`, `deleteMessage`, `getUpdates`, file uploads, etc. deferred.
- `AppStoreSpyClient.getAppMetadata` — covers only app lookup; list-apps / email-extraction endpoints deferred.
- `CloudFnClient.sendEmail` — covers only send; bounce/delivery callbacks deferred.
- `TelegramNotificationAdapter` — payload-envelope parsing is a skeleton; full domain routing (recipient resolution, templates, retries with idempotency key) deferred.

## Decisions Realised

| Decision | Realisation |
|----------|-------------|
| D-03 | 3 per-service adapters exist at apps/{notifier,parser,sender}/src/infrastructure/clients/{api}/ |
| D-08 | Each adapter has its own opossum CB (created in AbstractHttpClient.onModuleInit with its own cbOptions) |
| D-10 | Telegram/CloudFn POST: no idempotent flag, single-shot. AppStoreSpy GET: default retry applies |
| D-13 | grep audit: 0 Telegram/AppStoreSpy/CloudFn/opossum references in any /health/ directory |
| D-15 | AbstractHttpClient already emits 6-field log per call (verified Phase 24-01) — adapters inherit |
| D-16 | AbstractHttpClient already excludes bodies from logs — adapters inherit |
| D-18 | 1 skeleton method per adapter; business-logic surface deferred |
| D-20 | Symbol.for('TELEGRAM_CLIENT'/'APPSTORESPY_CLIENT'/'CLOUDFN_CLIENT') for all tokens |
| HTTP-03 | 3 adapters file count verified (find pattern → 3) |
| HTTP-04 | grep opossum/CircuitBreaker in gRPC foundation + gateway/audience/auth apps → 0 hits |

## Known Gaps Carried Forward

- Vendor URL patterns: Telegram base URL expects `https://api.telegram.org/bot<TOKEN>` format; smoke matrix documents this.
- Per-adapter CB tuning: all three use `HTTP_CLIENT_DEFAULTS` (5 consec failures / 30s half-open). Per-API tuning deferred.
- Response-schema Zod validation (T-24-14): deferred to business-logic phase.
- Telegram domain routing: JSON-envelope payload is a skeleton; real `Notification` → `SendMessageRequest` translation deferred.
- Sender/parser HTTP smoke controllers are ungated — rely on service not being exposed publicly in production (per threat-register T-24-09/13 acceptance).

## Threat Flags

None. No new trust boundaries introduced beyond the threat model declared in `24-03-PLAN.md`.

## Task 3 — Checkpoint Pending

Task 3 is a `checkpoint:human-verify`. Executor pauses here. Human runs the 6-item manual smoke matrix from `24-VALIDATION.md` § "Manual-Only Verifications" and replies "approved" to close the plan.

## Self-Check: PASSED

All 16 created files verified present on disk. Deleted stub file verified absent. All 4 commits (`efc0168`, `dc63610`, `bb27f9d`, `1d7d46b`) found in git log.
