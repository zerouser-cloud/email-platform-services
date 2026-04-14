---
phase: 260414-l7g-reset-scripts
plan: 01
subsystem: scripts,docs
tags: [npm-scripts, docker-compose, runbook, clean-slate, local-dev]
requires: []
provides:
  - reset:native npm script (docker compose down --volumes for native infra stack)
  - reset:isolated npm script (docker compose down --volumes for isolated full stack)
  - Runbook reset subsections in §1 Local-native and §2 Local-isolated
affects:
  - package.json scripts block
  - docs/runbooks/bucket-provisioning.md (Local-native + Local-isolated sections)
tech_stack_added: []
tech_stack_patterns: []
key_files_created: []
key_files_modified:
  - package.json
  - docs/runbooks/bucket-provisioning.md
decisions:
  - Inline full `docker compose ...` invocation in reset:* scripts (not `pnpm stop:* --volumes` chaining) — pnpm flag forwarding to compose down is unreliable
  - Manual-bootstrap philosophy preserved (Phase 22.5 D-05/D-06): reset:* does NOT auto-chain garage:bootstrap
  - Reset scripts are local-only; §3 Dev and §4 Prod intentionally untouched
metrics:
  duration: 75s
  tasks: 2
  files: 2
  completed: 2026-04-14T12:20:45Z
---

# Quick Task 260414-l7g: Add `reset:native` / `reset:isolated` Scripts Summary

Added two `pnpm reset:*` npm scripts that mirror `stop:*` counterparts with `--volumes`, plus documented them in the bucket-provisioning runbook (Local-native + Local-isolated) as the canonical clean-slate workflow preserving manual `garage:bootstrap`.

## Tasks Executed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add reset:native and reset:isolated scripts to package.json | 446ce38 | package.json |
| 2 | Document reset commands in bucket-provisioning runbook | 7546ef9 | docs/runbooks/bucket-provisioning.md |

## What Was Built

### `reset:native`
```
docker compose --env-file .env.docker -f infra/docker-compose.infra.yml -f infra/docker-compose.dev-ports.yml -f infra/docker-compose.webui-ports.yml down --volumes
```
Tears down the native infra stack AND removes all its managed volumes (Garage meta+data, Postgres, RabbitMQ, Redis). Overlay flags identical to `infra:down`, only `--volumes` added.

### `reset:isolated`
```
docker compose --env-file .env.docker -f infra/docker-compose.yml -f infra/docker-compose.webui-ports.yml down --volumes
```
Tears down the isolated full-stack compose AND removes all its managed volumes. Overlay flags identical to `docker:down`, only `--volumes` added.

### Runbook subsections
- `docs/runbooks/bucket-provisioning.md` §1 (line 328): "Сброс до чистого состояния" between Verify and Common Pitfalls
- `docs/runbooks/bucket-provisioning.md` §2 (line 484): parallel subsection with `reset:isolated` / `start:isolated`

Both explain when to use, what gets nuked, the re-setup sequence (`pnpm start:* && pnpm garage:bootstrap`), and explicitly note the manual-bootstrap rule (Phase 22.5 D-05/D-06).

## Verification

Task 1 automated checks — all passed:
- `grep -c '"reset:' package.json` → 2
- `grep -c 'down --volumes' package.json` → 2
- JSON parse OK
- Existing `stop:native` / `stop:isolated` values unchanged (`pnpm infra:down` / `pnpm docker:down`)

Task 2 automated checks — all passed:
- `grep -c "Сброс до чистого состояния" docs/runbooks/bucket-provisioning.md` → 2
- Both reset subsections positioned between `### Шаг 6: Verify` (line 230/446) and `### Common Pitfalls` (line 345/501)
- §3 Dev (line 651) and §4 Prod (line 841) sections untouched

Overall plan check: `git diff --stat` across both commits shows exactly 2 files modified (+36 lines), zero unintended changes.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- FOUND: package.json (modified with reset:native + reset:isolated entries)
- FOUND: docs/runbooks/bucket-provisioning.md (modified with 2 reset subsections)
- FOUND commit: 446ce38 (Task 1 — scripts)
- FOUND commit: 7546ef9 (Task 2 — runbook)
