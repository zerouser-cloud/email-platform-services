---
name: runtime-smoke-verification
description: Run smoke verification of the project runtime after a GSD phase finishes or after any non-trivial code edit. Triggers on phase verification, post-execute-phase smoke, post-refactor sanity check, "verify it works", "smoke test", "runtime check", DI resolution check, after merge to main, after dependency change. Use ONLY pnpm scripts from package.json — never invent commands. If a needed command is missing, ASK the user. Test ALL local startup flows the project supports (e.g., native + isolated).
---

# Runtime Smoke Verification

After completing a GSD phase or making non-trivial code edits, verify the project actually starts and behaves correctly. Use only the project's own `package.json` scripts — do not invent commands. Test every local startup flow the project supports.

## Rule: Use Only `package.json` Scripts

**Always invoke verification via `pnpm <script-name>`** (or `npm run <script>` / `yarn <script>` for non-pnpm projects). The user has memory:

> "Use package.json scripts — Always use `pnpm <script>` for running stack, never raw `docker compose -f ...`"

If a needed verification step has no corresponding script in `package.json`:

1. **STOP. Do not invent the command.**
2. Tell the user: "Need `<verb>` step but no `<expected:script>` in package.json. Add the script, or grant one-time permission to run `<concrete command>`?"
3. Wait for user decision. Either they add the script (preferred), or they explicitly authorize a one-time custom command.

**Never silently fall back to raw `docker compose ...`, `node dist/...`, or other ad-hoc invocations** — even if you "know" what they should be. The project author owns the runtime contract via `package.json`.

## When to Apply This Skill

```
After completing a GSD phase (pre-verification handoff)?            → APPLY
After a merge to a working branch?                                  → APPLY
After a non-trivial refactor (DI changes, module wiring, configs)?  → APPLY
After updating dependencies / lockfile?                             → APPLY
User asks "does it still work" / "smoke test" / "verify"?           → APPLY
After a one-line typo fix?                                          → SKIP (build/lint covers)
After a docs-only change?                                           → SKIP
After a test-only change?                                           → SKIP (just run the tests)
```

## Discovery Procedure (Always Run First)

Before constructing any verification recipe, READ `package.json` and enumerate:

```bash
cat package.json | node -e 'const p=JSON.parse(require("fs").readFileSync(0,"utf8")); console.log(JSON.stringify(p.scripts, null, 2));'
```

Classify each script into one of these categories:

| Category | Examples | Purpose |
|---|---|---|
| **Build** | `build`, `typecheck` | Static verification |
| **Lint** | `lint`, `lint:fix`, `check-arch` | Code quality / architecture |
| **Start (per flow)** | `start:native`, `start:isolated`, `start:prod` | Runtime up |
| **Stop (per flow)** | `stop:native`, `stop:isolated` | Clean shutdown |
| **Reset (per flow)** | `reset:native`, `reset:isolated` | Volume / state wipe |
| **Infra-only** | `infra:up`, `infra:down`, `db:reset` | External services |
| **Test** | `test`, `test:e2e`, `test:integration` | Automated tests |
| **Health endpoints** | (no script — known URL like `/health/ready`) | Readiness probe |

**Identify ALL local startup flows.** Most monorepos have at least:
- A "native" / "dev" flow (services on host, infra in containers)
- An "isolated" / "docker" flow (everything in containers)

If both exist, **verify both** — they exercise different env paths and may break independently.

## Decision Tree — Which Flows to Verify

```
Is the change scope strictly internal to a single service?
├─ Yes → verify the affected service starts
│         + its consumers (if cross-service wiring touched)
└─ No (touches monorepo-wide config, DI, foundation, contracts) →
        verify ALL flows that exist (native + isolated + others)

Is there a runtime-resolved DI graph (NestJS, Spring, .NET DI, etc.)?
├─ Yes → runtime smoke is MANDATORY (build/types can't catch DI mismatch)
└─ No  → build/lint may suffice for structural changes

Is there an HTTP / gRPC / message-queue surface?
├─ Yes → after start, hit /health, /ready, or send one round-trip request
└─ No  → confirm "started successfully" log and stop
```

## Per-Flow Verification Recipe

For EACH flow you decide to verify, run this canonical sequence:

```
1. Stop any leftover from a prior run        — pnpm stop:<flow>
2. (Optional) Reset volumes if state is stale — pnpm reset:<flow>
3. Build                                      — pnpm build
4. Lint                                       — pnpm lint
5. (Optional) Architecture check              — pnpm check-arch
6. Start the flow                             — pnpm start:<flow>
7. Wait for boot signal                       — log "started" / health endpoint 200
8. Hit health endpoints                       — curl /health/ready, /health/live
9. (Optional) Run a representative request    — single round-trip per surface
10. Stop the flow                             — pnpm stop:<flow>
```

**Skip step 2 (reset)** unless the previous state would invalidate the test (schema migrations, seeded data, dirty docker volumes from a failed prior run). Reset is destructive — confirm with the user before invoking on a flow they may have unsaved work in.

## What to Verify in the Output

Look for these signals — they're the reliable smoke results:

- **Build/lint exit code 0** — no static errors
- **All services log "started successfully" / "Nest application successfully started"** — DI graph resolved
- **`/health/ready` returns 200 with all expected upstream entries `up`** — wiring works end-to-end
- **No `Cannot resolve dependencies of XClient`** — Symbol/identity contracts intact (NestJS-specific)
- **No `EADDRINUSE`** — clean port state (means stop step worked)

## What to Do When a Script Is Missing

```
Need to verify <X> but `package.json` has no `<expected-script>`.

Options:
1. (Recommended) Add the script to package.json so future runs are scripted
2. Grant one-time permission to run a specific concrete command
```

Examples of legitimate "missing script" cases:

| Need | Likely script name | If missing → ask user |
|---|---|---|
| Health endpoint check | `smoke:ready` | "Add `pnpm smoke:ready` calling curl, or one-time `curl -s :3000/health/ready`?" |
| End-to-end smoke | `smoke:e2e` | "Add `pnpm smoke:e2e`, or one-time pytest invocation?" |
| Schema push | `db:push` / `prisma:push` | "Add `pnpm db:push`, or one-time `npx prisma db push`?" |
| Seed data | `db:seed` | "Add `pnpm db:seed`, or one-time SQL invocation?" |

**Never silently substitute** — the user explicitly cares about this boundary.

## Post-Verification Report

After running the verification, report concisely:

```
## Runtime Smoke — {Flow Name}

| Step | Command | Result |
|------|---------|--------|
| Stop prior | pnpm stop:native | ✓ |
| Build | pnpm build | ✓ 10/10 tasks |
| Lint | pnpm lint | ✓ 7/7 tasks |
| Start | pnpm start:native | ✓ all services up after 28s |
| Health | curl :3000/health/ready | ✓ 5/5 upstreams up |
| Stop | pnpm stop:native | ✓ |

Summary: PASS — all checks green.
```

If any step failed:

```
## Runtime Smoke — {Flow Name} — FAILED

Step that failed: {step name}
Exit code: {N}
First failure line: {grep result}

Likely cause: {brief diagnosis}

Recommended next: {single action — re-run with verbose? open a debug session? abort?}
```

## Anti-Patterns

```bash
# ANTI-PATTERN 1 — invented script name
pnpm start:infra:native      # ← does not exist; the actual script may be `infra:up`
                              # → Stop. Read package.json. Use the real name.

# ANTI-PATTERN 2 — raw docker compose
docker compose -f infra/docker-compose.infra.yml up -d
# → STOP. The user has explicit memory: "Always use pnpm <script>, never raw docker compose -f"
# → Use `pnpm infra:up` (which wraps it).

# ANTI-PATTERN 3 — only verifying one flow
# Project has native + isolated. You verified native and called it done.
# → Both flows can break independently — verify each that's locally available.

# ANTI-PATTERN 4 — silent destructive reset
pnpm reset:native           # ← wipes volumes without telling user first
# → Reset is destructive. Confirm with user before invoking, unless they explicitly asked for reset.

# ANTI-PATTERN 5 — claiming "verified" without running smoke
"All builds pass — phase complete."
# → Build/lint don't catch DI graph errors, env-config drift, or runtime-only failures.
# → If the phase touches runtime wiring, RUN the smoke. State explicitly if you cannot
#   (e.g., infra not available locally) instead of implying success.

# ANTI-PATTERN 6 — running smoke without stopping prior state
pnpm start:native            # ← without prior stop, port collisions / stale containers
# → Always include `pnpm stop:<flow>` (or detect clean state) before start.
```

## Project-Specific Note

This project (Email Platform) has these flows confirmed via `package.json`:

- **Native** (services on host + infra in Docker):
  `pnpm start:native` / `pnpm stop:native` / `pnpm reset:native`
- **Isolated** (everything in Docker, with `--build`):
  `pnpm start:isolated` / `pnpm stop:isolated` / `pnpm reset:isolated`
- **Infra-only:** `pnpm infra:up` / `pnpm infra:down`
- **Storage bootstrap:** `pnpm storage:bootstrap` (Garage S3 keys/buckets)
- **Static checks:** `pnpm build`, `pnpm lint`, `pnpm typecheck`, `pnpm check-arch`
- **Health endpoint:** `GET http://localhost:3000/health/ready` (gateway, native mode default port)

When verifying after a phase that touches runtime wiring (DI, gRPC clients, modules):
1. Run BOTH flows when feasible — native catches host-env issues, isolated catches Dockerfile / image issues
2. Per flow: stop → build → lint → start → wait for boot → curl /health/ready → stop
3. Report 5 upstream gRPC clients all `up` for gateway readiness check
4. If any flow fails, report verbatim error and stop — do NOT proceed to "phase complete"

## See Also

- `.agents/skills/infrastructure-guard/SKILL.md` — never change ports / docker-compose without approval (smoke verification must respect this — don't fix infra issues, report them)
- `.agents/skills/gsd-flow-guard/SKILL.md` — route smoke through the GSD workflow that owns it (e.g., execute-phase verification step)
- Memory: `feedback_use_package_scripts` — codifies the "always use pnpm scripts" rule
