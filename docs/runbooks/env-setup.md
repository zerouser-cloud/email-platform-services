# Runbook: Environment Files (`.env` / `.env.docker` / `.env.docker.example`)

> **Operational runbook** for environment-variable setup across four Email Platform
> deployment scenarios (local native, local docker-isolated, Coolify dev, Coolify prod).
> Covers onboarding, the env-file parity rule, and the secret rotation procedure for
> all external API tokens.

**⚠ Synchronisation with code:** When adding or renaming an env var, update
`packages/config/src/schemas/*.ts` (Zod schemas), `.env` (local-native), `.env.docker`
(local-isolated), and `.env.docker.example` (tracked template) in the SAME PR.
`bash scripts/check-env-parity.sh` enforces key-set parity between tracked files.

---

## Env-file Matrix

Four environments, three file roles, one set of env keys.

| # | Scenario                | Config source              | Start command         | Notes                                                      |
| - | ----------------------- | -------------------------- | --------------------- | ---------------------------------------------------------- |
| 1 | Local native            | `.env` (UNTRACKED)         | `pnpm start:native`   | Infra in Docker (via `pnpm infra:up`), services on host.   |
| 2 | Local docker-isolated   | `.env.docker` (UNTRACKED)  | `pnpm start:isolated` | All services + infra in Docker Compose. Self-contained.    |
| 3 | Coolify Dev             | Coolify Env UI             | auto on `dev` push    | Same key-set as `.env.docker.example`; real secrets.       |
| 4 | Coolify Prod            | Coolify Env UI             | auto on release       | Same key-set as `.env.docker.example`; real secrets.       |

### File role table

| File                       | Tracked? | Purpose                                                                                         |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `.env.example`             | YES      | Template for `.env` (local-native). Copy-edit to create `.env`.                                 |
| `.env`                     | NO       | Local-native runtime values (localhost hostnames, real/test secrets). Per-developer machine.    |
| `.env.docker.example`      | YES      | Canonical template for `.env.docker`. Variant B — hostnames + dev passwords pre-filled, only the 5 real secrets as `replace-me-*`. |
| `.env.docker`              | NO       | Local docker-isolated runtime values (service-name hostnames, real/test secrets). Per-machine.  |
| `.gitignore:17`            | YES      | Blocks `.env.docker` from accidental tracking.                                                  |
| `scripts/check-env-parity.sh` | YES   | Compares UPPER_SNAKE_CASE key-sets of `.env`, `.env.docker`, `.env.docker.example`. Exit 1 on drift. |
| `scripts/check-no-bang.sh` | YES      | Audits the HTTP surface for `config.get<T>(KEY)!` non-null assertions. Exit 1 on violation.     |

---

## Env-file Key-Parity Rule

When adding or renaming an env var, update **all** of the following in the same PR:

1. `packages/config/src/schemas/*.ts` — add the Zod field (no `.default()`, no `.optional()`, no `z.coerce.boolean()` — see `.agents/skills/env-schema/SKILL.md`).
2. `.env` — local-native value (with `localhost` or host paths).
3. `.env.docker` — docker-isolated value (with docker service-name hostnames).
4. `.env.docker.example` — tracked template; pre-filled value for non-secrets, `replace-me-<kebab-name>` for secrets.
5. Coolify Env UI (dev + prod) — real values. Do this BEFORE the code that reads the key ships, or boot will fail with `TypeError: Configuration key "<key>" does not exist`.

**Enforcement command:**

```bash
bash scripts/check-env-parity.sh
```

PASS across `.env` vs `.env.docker` and `.env.docker` vs `.env.docker.example`. Exit 1 on drift, prints keys unique to each file.

A key present in one file but missing in another is config drift — it will silently diverge across environments and eventually break boot on one of them. Treat any drift warning as a blocking defect.

---

## 1. Local Native (`pnpm start:native`)

Services run on host, infrastructure runs in Docker. Useful for debugging services (breakpoints, log tailing) while still using realistic Postgres/Redis/RabbitMQ/Garage.

**Prerequisites:**
- Node.js 20+ (`node --version`)
- pnpm 9+ (`pnpm --version`)
- Docker + Docker Compose (`docker --version`, `docker compose version`)

**First-time setup:**
1. `pnpm install`
2. `cp .env.example .env` — template to per-machine file.
3. Edit `.env` and fill the 5 `replace-me-*` secrets (see `## Secret Rotation Procedure` below for each).
4. `pnpm infra:up` — brings up Postgres, Redis, RabbitMQ, Garage on localhost ports (5432 / 6379 / 5672 / 3900).
5. `pnpm start:native` — runs all 6 NestJS services on host (gateway on port 4000, auth/sender/parser/audience/notifier on their respective ports).

**Verify:** `curl -s http://localhost:4000/health/ready` → HTTP 200 with `{ "status": "ok", ... }`.

**Stop:** `pnpm stop:native` (graceful) or `pnpm reset:native` (down + remove volumes).

---

## 2. Local Docker-isolated (`pnpm start:isolated`)

All 6 services + infrastructure run inside Docker Compose. Matches production topology most closely; recommended for end-to-end verification.

**Prerequisites:**
- Docker + Docker Compose (no host services required — stack is self-contained).

**First-time setup:**
1. `pnpm install`
2. `cp .env.docker.example .env.docker` — copy tracked template to local (untracked) runtime file.
3. Edit `.env.docker` and replace the 5 `replace-me-*` placeholders with real values:
   - `TELEGRAM_BOT_TOKEN` (placeholder: `replace-me-telegram-bot-token`) — from @BotFather (see Secret Rotation Procedure).
   - `APPSTORESPY_API_KEY` (placeholder: `replace-me-appstorespy-api-key`) — from AppStoreSpy dashboard.
   - `CLOUDFN_API_KEY` (placeholder: `replace-me-cloudfn-api-key`) — from Google Cloud Functions project API keys.
   - `STORAGE_ACCESS_KEY` (placeholder: `replace-me-storage-access-key`), `STORAGE_SECRET_KEY` (placeholder: `replace-me-storage-secret-key`) — from Garage WebUI (see `docs/runbooks/bucket-provisioning.md`).
4. `pnpm start:isolated` — builds images if needed and starts the full stack via Docker Compose.

**Verify:** `curl -s http://localhost:4000/health/ready` → HTTP 200.

**Stop:** `pnpm stop:isolated` (graceful) or `pnpm reset:isolated` (down + remove volumes).

**⚠ `.env.docker` is UNTRACKED** (`.gitignore` line 17). Never `git add .env.docker`. If shared changes are needed, edit `.env.docker.example` instead (use `replace-me-*` placeholders for any new secrets).

---

## 3. Coolify Dev (auto-deploy on `dev` push)

Env vars live in Coolify Dev project → Environment. Same key-set as `.env.docker.example`.

**Real-secret differences from local:**
- `STORAGE_ACCESS_KEY` / `STORAGE_SECRET_KEY` — Garage dev keys (generated per-env in Garage WebUI; see `docs/runbooks/bucket-provisioning.md`).
- `TELEGRAM_BOT_TOKEN` / `APPSTORESPY_API_KEY` / `CLOUDFN_API_KEY` — real production-or-shared tokens (unless the project uses dev-specific bots/keys).

**Hostnames:** Coolify injects service DNS names; the docker-network hostnames from `.env.docker.example` (`postgres`, `redis`, etc.) are not applicable — Coolify's service mesh resolves them differently per deployment.

**Verify after deploy:** `curl -s https://api.dev.email-platform.pp.ua/health/ready` → HTTP 200.

---

## 4. Coolify Prod (auto-deploy on release)

Same structure as Coolify Dev. All real secrets live only in Coolify Production env. Never commit prod secret values anywhere.

**Verify after deploy:** `curl -s https://api.email-platform.pp.ua/health/ready` → HTTP 200.

---

## Onboarding — first-time developer

Pick local native OR local docker-isolated (both valid). Most common flow: `start:isolated` for end-to-end work, `start:native` for debugging a single service.

**Docker-isolated path (recommended for first boot):**

```bash
# 1. Clone repo, install deps
pnpm install

# 2. Bootstrap .env.docker from tracked template
cp .env.docker.example .env.docker

# 3. Fill in the 5 `replace-me-*` secrets in .env.docker
#    (ask teammate for shared test credentials, or obtain from vendor dashboards — see Secret Rotation)
$EDITOR .env.docker

# 4. Verify env-file parity (should PASS — no drift)
bash scripts/check-env-parity.sh

# 5. Start the stack
pnpm start:isolated

# 6. In another terminal, verify health
curl -s http://localhost:4000/health/ready
```

Expected first-run output of `health/ready`:
```json
{
  "status": "ok",
  "info": { "...": "all subsystems up" }
}
```

If step 5 fails with `TypeError: Configuration key "<X>" does not exist`, you missed filling in a key — edit `.env.docker` and restart.

---

## Secret Rotation Procedure

Applicable when moving to production, on security incident, or when a secret is revoked by the vendor. For a test environment, rotation is optional — it is a risk-accept decision whether to rotate a leaked test token now or defer until before the first production release.

The 6-step procedure below generalises for any external API secret (Telegram bot token, AppStoreSpy API key, CloudFn API key, Garage access keys).

### Order matters

**Operator MUST complete steps 1–6 IN ORDER.** Deviating risks dev/prod outage between "new secret issued" and "env updated to use it".

```
1. Revoke old secret at vendor      ──► immediately invalidates old credential
2. Copy new secret to secure paste
3. Paste new secret into Coolify Prod env + save
4. Paste new secret into Coolify Dev env + save
   (Coolify redeploys both services automatically)
5. Update local `.env.docker` with new value (`sed -i ...` or editor)
6. Verify: tail service logs for outbound calls — expect `status_code: 200`,
   NO `401 Unauthorized` / `403 Forbidden`.
```

Commit step: there is no git commit for secret rotation itself — secrets live only in Coolify env + local untracked `.env.docker`. If git commit is triggered (e.g., updated runbook), it must NOT contain the new secret value.

### Telegram bot token (HARD-07 / D-29)

1. Open Telegram app → chat with @BotFather → `/mybots` → select bot → **"API Token"** → **"Revoke current token"**.
2. Confirm revocation. Copy the new token to a secure clipboard.
3. Update Coolify Production env: edit `TELEGRAM_BOT_TOKEN` → paste new value → save → trigger redeploy.
4. Update Coolify Dev env: same.
5. Update local `.env.docker`:
   ```bash
   sed -i 's|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=<new-token>|' .env.docker
   ```
6. Verify: Coolify redeploys notifier. Tail notifier logs for any `api: 'TelegramClient'` HTTP call — expect `status_code: 200`, no `401 Unauthorized`.

**Important:** Git history retains the old token in commits prior to rotation. That token is now invalid — historical references are dead weight, not an active threat. Git history is NOT rewritten (D-29 decision — less invasive than `filter-repo` for the team).

### AppStoreSpy API key

1. AppStoreSpy dashboard → API / API Keys → regenerate.
2. Steps 3–5: same as Telegram, but for `APPSTORESPY_API_KEY`.
3. Verify via dev / isolated deployment: parser's `AppStoreSpyClient` calls succeed (no `401` / `403`).

### Cloud Functions API key

1. Google Cloud Console → project → APIs & Services → Credentials → regenerate / create key.
2. Steps 3–5: same as Telegram, but for `CLOUDFN_API_KEY`.
3. Verify: sender's `CloudFnClient` calls succeed (runtime smoke through HttpSmokeController or real business traffic).

### Storage (Garage) access keys

Garage keys are bucket-scoped and generated per environment. See `docs/runbooks/bucket-provisioning.md` for the full Garage key lifecycle (key creation, bucket bindings, rotation).

---

## Verification

Runtime smoke sequence (after `pnpm start:isolated` — isolated stack is the canonical verification surface). Each command has an expected outcome; any deviation indicates a regression in the HTTP foundation (Phase 24 / 24.1).

```bash
# --- Health check (overall) ---
curl -s http://localhost:4000/health/ready
# Expect: { "status": "ok", "info": { ... all subsystems up ... } }

# --- HTTP foundation state (CB closed initially) ---
curl -s http://localhost:4000/test/http-client/state
# Expect: { "cb": "closed", "consecutiveFailures": 0 }

# --- Happy-path probe (CB stays closed) ---
curl -s -X POST http://localhost:4000/test/http-client/probe
# Expect: outcome.ok === true, after.cb === "closed"

# --- Force CB to open (5 consecutive failures) ---
curl -s -X POST 'http://localhost:4000/test/http-client/burst-fail?count=5&timeoutMs=1'
# Expect: 5 failed results, finalState.cb === "opened"

# --- Fast-fail in open state (<1s, no retries) ---
curl -s -X POST http://localhost:4000/test/http-client/probe
# Expect: outcome.ok === false, error contains "Circuit open for HttpSmokeClient"

# --- 5xx IS retried (3 attempts, ~1.5–7s total) ---
time curl -s -X POST 'http://localhost:4000/test/http-client/status?code=500'
# Expect: ~1.5–7s total (3 retry attempts with jitter backoff)

# --- 4xx is NOT retried (single attempt, <1s) ---
time curl -s -X POST 'http://localhost:4000/test/http-client/status?code=404'
# Expect: <1s total (single attempt, 4xx not retried)
```

**Env-file parity:**

```bash
bash scripts/check-env-parity.sh
# Expect: PASS across .env vs .env.docker and .env.docker vs .env.docker.example
```

**Non-null assertion audit (HTTP surface):**

```bash
bash scripts/check-no-bang.sh
# Expect: PASS across all HTTP surface paths
# (telegram / appstorespy / cloudfn / http-smoke-infrastructure / http-smoke-test)
```

If any command deviates from the expected outcome, treat it as a gap-closure trigger: open an issue, reference the runbook step that failed, and plan a follow-up phase.

---

## File Reference (quick lookup)

| File                                 | Tracked | Purpose                                                                          |
| ------------------------------------ | ------- | -------------------------------------------------------------------------------- |
| `.env`                               | NO      | Native-dev values (localhost hostnames)                                          |
| `.env.example`                       | YES     | Template for `.env`                                                              |
| `.env.docker`                        | NO      | Docker-isolated values (service-name hostnames)                                  |
| `.env.docker.example`                | YES     | Template for `.env.docker` (variant B — secrets only as `replace-me-*`)          |
| `.gitignore` line 17                 | YES     | Excludes `.env.docker` from tracking                                             |
| `scripts/check-env-parity.sh`        | YES     | CI-friendly key-set parity check across `.env`, `.env.docker`, `.env.docker.example` |
| `scripts/check-no-bang.sh`           | YES     | CI-friendly non-null-assertion audit for HTTP surface                            |
| `packages/config/src/schemas/*.ts`   | YES     | Zod env schemas (strict: no defaults, no optionals, no `z.coerce.boolean`)       |
| `docs/runbooks/bucket-provisioning.md` | YES   | Garage bucket + S3 access key lifecycle across all 4 environments                |

---

*Created 2026-04-16 as part of Phase 24.1 (http-client-foundation-hardening-di-env-hygiene-magic-values) — HARD-07 / D-32.*
