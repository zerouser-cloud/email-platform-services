# Deferred Items — Phase 999.1.8

Items discovered during plan execution that are OUT OF SCOPE for the triggering plan.
Logged here per scope-boundary rule in executor protocol.

## From Plan 04 (2026-04-21)

### 1. Unused RMQ event.consumer.ts parameters (warnings)

- **File:** `apps/notifier/src/infrastructure/inbound/rmq/event.consumer.ts:20`
- **Issue:** Two ESLint warnings (not errors):
  - `'eventType' is defined but never used. Allowed unused args must match /^_/u`
  - `'payload' is defined but never used. Allowed unused args must match /^_/u`
- **Why deferred:** Pre-existing warnings, not caused by Plan 04 changes (which only touched `loadConfig` import migration). Unrelated to the config mechanism consolidation objective.
- **Suggested fix:** Prefix unused params with underscore (`_eventType`, `_payload`) or add a logger invocation that consumes them — depends on RMQ consumer body design.
- **Owner:** Future RMQ consumer implementation plan (phase TBD — not this phase's scope).
