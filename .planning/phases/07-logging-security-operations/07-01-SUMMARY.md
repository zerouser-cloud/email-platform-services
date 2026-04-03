---
phase: 07-logging-security-operations
plan: 01
subsystem: logging
tags: [pino, nestjs, interceptor, observability, structured-logging]

# Dependency graph
requires:
  - phase: 02-configuration-management
    provides: ConfigService DI and NODE_ENV/LOG_LEVEL/LOG_FORMAT env vars
  - phase: 06-health-resilience
    provides: Service module structure with LoggingModule imports
provides:
  - Pino base fields (service, environment, instanceId) on every log entry
  - HttpTimingInterceptor for HTTP request/response timing
  - serviceName parameter on all LoggingModule factory methods
affects: [07-logging-security-operations, 08-verification]

# Tech tracking
tech-stack:
  added: []
  patterns: [pino-base-fields, http-timing-interceptor, service-name-injection]

key-files:
  created:
    - packages/foundation/src/logging/http-timing.interceptor.ts
  modified:
    - packages/foundation/src/logging/logging.module.ts
    - packages/foundation/src/index.ts
    - apps/gateway/src/gateway.module.ts
    - apps/auth/src/auth.module.ts
    - apps/sender/src/sender.module.ts
    - apps/parser/src/parser.module.ts
    - apps/audience/src/audience.module.ts
    - apps/notifier/src/notifier.module.ts

key-decisions:
  - "instanceId generated once at module file scope via crypto.randomUUID() -- stable per process"
  - "Sync forHttp/forGrpc use process.env.NODE_ENV fallback since ConfigService unavailable"
  - "HttpTimingInterceptor registered as APP_INTERCEPTOR in forHttp/forHttpAsync only"

patterns-established:
  - "Service name injection: all LoggingModule calls require explicit serviceName string"
  - "Base fields pattern: service/environment/instanceId in every Pino log entry"

requirements-completed: [LOG-01, LOG-02]

# Metrics
duration: 2min
completed: 2026-04-03
---

# Phase 07 Plan 01: Structured Logging Base Fields Summary

**Pino base fields (service, environment, instanceId) injected into all log entries with HttpTimingInterceptor for gateway HTTP timing**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-03T06:19:35Z
- **Completed:** 2026-04-03T06:21:16Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Every Pino log entry now includes service name, environment, and instanceId base fields for production log aggregation
- Created HttpTimingInterceptor logging method, path, statusCode, durationMs for HTTP requests
- All 6 service modules pass their service name to LoggingModule factory methods

## Task Commits

Each task was committed atomically:

1. **Task 1: Add base fields to LoggingModule and create HttpTimingInterceptor** - `37c463f` (feat)
2. **Task 2: Update all 6 service modules to pass serviceName** - `f5bc522` (feat)

## Files Created/Modified
- `packages/foundation/src/logging/logging.module.ts` - Added serviceName param and base fields to all 4 factory methods
- `packages/foundation/src/logging/http-timing.interceptor.ts` - New HTTP request timing interceptor
- `packages/foundation/src/index.ts` - Barrel export for HttpTimingInterceptor
- `apps/gateway/src/gateway.module.ts` - forHttpAsync('gateway')
- `apps/auth/src/auth.module.ts` - forGrpcAsync('auth')
- `apps/sender/src/sender.module.ts` - forGrpcAsync('sender')
- `apps/parser/src/parser.module.ts` - forGrpcAsync('parser')
- `apps/audience/src/audience.module.ts` - forGrpcAsync('audience')
- `apps/notifier/src/notifier.module.ts` - forHttpAsync('notifier')

## Decisions Made
- instanceId generated once at module file scope via crypto.randomUUID() -- stable per process, not per request
- Sync forHttp/forGrpc variants use process.env.NODE_ENV fallback since ConfigService is unavailable in sync context
- HttpTimingInterceptor registered as APP_INTERCEPTOR only in forHttp/forHttpAsync (not gRPC, which has its own GrpcLoggingInterceptor)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Foundation dist/ rebuild required for downstream compilation**
- **Found during:** Task 2 (service module updates)
- **Issue:** Apps resolve @email-platform/foundation from dist/ (package.json main: dist/index.js). After updating source, tsc --noEmit in apps failed because dist/ had stale types.
- **Fix:** Ran `pnpm -r --filter @email-platform/foundation run build` before verifying app compilation.
- **Verification:** Full monorepo `pnpm -r exec tsc --noEmit` passes clean.
- **Committed in:** f5bc522 (part of Task 2 verification)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Standard build chain requirement, no scope creep.

## Issues Encountered
None beyond the dist/ rebuild noted above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Base fields and HTTP timing in place, ready for Plan 02 (graceful shutdown, signal handling)
- GrpcLoggingInterceptor already logs duration -- confirmed, no changes needed

## Self-Check: PASSED

All files exist, all commits verified, all acceptance criteria met (16/16 checks passed).

---
*Phase: 07-logging-security-operations*
*Completed: 2026-04-03*
