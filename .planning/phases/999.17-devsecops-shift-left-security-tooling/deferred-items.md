# Phase 999.17 — Deferred Items

Items discovered during execution but out-of-scope for the current plan. Tracked here per the scope-boundary rule (executor only auto-fixes issues directly caused by the current task's changes).

## D-1: Pre-existing TS2742 in `apps/gateway/src/infrastructure/bootstrap/health/health.controller.ts:70`

**Discovered during:** Plan 999.17-11 Task 3 (`pnpm run build` smoke after strictDepBuilds gate enabled)

**Finding:** `pnpm run build` fails at `@email-platform/gateway` with:

```
src/infrastructure/bootstrap/health/health.controller.ts:70:9 - error TS2742:
The inferred type of 'readiness' cannot be named without a reference to
'../../../../../../packages/foundation/node_modules/@nestjs/terminus/dist'.
This is likely not portable. A type annotation is necessary.

70   async readiness() {
             ~~~~~~~~~

Found 1 error(s).
```

**Origin:** Pre-existing — last commit on this file is `d47792c` (Phase 999.12.1, "rename HEALTH.INDICATOR.{REDIS,RABBITMQ,POSTGRESQL} → {CACHE,MESSAGING,PERSISTENCE}"). Reproduced in the parent worktree (PARENT_BUILD_EXIT=1) BEFORE Plan 999.17-11 changes were applied. Not caused by the build-script trust gate.

**Why deferred:** Out of scope for Plan 999.17-11 (gap closure for CR-01, build-script trust). The TS2742 is a pnpm-symlink-traversal type-export issue from a different phase's refactor — separate concern, separate phase.

**Suggested next action:** Route to `/gsd:fast` or open as a Phase 999.12.1 follow-up. The fix is likely a one-liner adding an explicit return type annotation:

```typescript
async readiness(): Promise<HealthCheckResult> {
```

**Lint and post-install execution gate are unaffected** — Plan 999.17-11 acceptance criteria for those passed.
