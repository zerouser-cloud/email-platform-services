---
phase: 06-health-resilience
plan: 02
subsystem: health
tags: [nestjs-terminus, health-checks, liveness, readiness, kubernetes]

# Dependency graph
requires:
  - phase: 06-health-resilience/01
    provides: foundation health indicators (MongoHealthIndicator, RedisHealthIndicator, RabbitMqHealthIndicator)
provides:
  - per-service correct readiness probes (auth=Mongo, sender=Mongo+Redis, parser=Mongo, audience=Mongo, notifier=RabbitMQ)
  - simplified liveness probes (empty check, always 200) on all 5 backend services
  - notifier consolidated to foundation RabbitMqHealthIndicator
affects: [06-health-resilience, deployment, kubernetes]

# Tech tracking
tech-stack:
  added: []
  patterns: [empty-liveness-probe, per-service-dependency-readiness]

key-files:
  created: []
  modified:
    - apps/auth/src/health/health.controller.ts
    - apps/auth/src/health/health.module.ts
    - apps/sender/src/health/health.controller.ts
    - apps/sender/src/health/health.module.ts
    - apps/parser/src/health/health.controller.ts
    - apps/parser/src/health/health.module.ts
    - apps/audience/src/health/health.controller.ts
    - apps/audience/src/health/health.module.ts
    - apps/notifier/src/health/health.controller.ts
    - apps/notifier/src/health/health.module.ts

key-decisions:
  - "Liveness probes return this.health.check([]) -- no heap check prevents unnecessary pod restarts"
  - "Each service readiness checks only its actual infrastructure dependencies"
  - "Notifier local RabbitMQHealthIndicator deleted in favor of foundation RabbitMqHealthIndicator"

patterns-established:
  - "Empty liveness: all services use this.health.check([]) for liveness"
  - "Dependency-scoped readiness: each service imports and checks only its real dependencies"

requirements-completed: [HLTH-03]

# Metrics
duration: 2min
completed: 2026-04-02
---

# Phase 06 Plan 02: Per-Service Health Probes Summary

**Simplified liveness to empty check (no heap) and scoped readiness to actual dependencies per service: auth/parser/audience=MongoDB, sender=MongoDB+Redis, notifier=RabbitMQ via foundation indicator**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-02T17:27:40Z
- **Completed:** 2026-04-02T17:29:21Z
- **Tasks:** 2
- **Files modified:** 11 (10 modified, 1 deleted)

## Accomplishments
- Removed heap memory check from liveness on all 5 backend services -- liveness now always returns 200
- Auth, parser, audience readiness scoped to MongoDB only (removed unused Redis and RabbitMQ indicators)
- Sender readiness scoped to MongoDB + Redis (removed unused RabbitMQ indicator)
- Notifier consolidated from local old-pattern RabbitMQHealthIndicator to foundation RabbitMqHealthIndicator

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix auth, parser, audience health (liveness=empty, readiness=MongoDB only)** - `50d4d4f` (feat)
2. **Task 2: Fix sender health (readiness=MongoDB+Redis) and notifier health (use foundation indicator)** - `b4a7856` (feat)

## Files Created/Modified
- `apps/auth/src/health/health.controller.ts` - Liveness=empty, readiness=MongoDB only
- `apps/auth/src/health/health.module.ts` - Providers reduced to MongoHealthIndicator only
- `apps/parser/src/health/health.controller.ts` - Liveness=empty, readiness=MongoDB only
- `apps/parser/src/health/health.module.ts` - Providers reduced to MongoHealthIndicator only
- `apps/audience/src/health/health.controller.ts` - Liveness=empty, readiness=MongoDB only
- `apps/audience/src/health/health.module.ts` - Providers reduced to MongoHealthIndicator only
- `apps/sender/src/health/health.controller.ts` - Liveness=empty, readiness=MongoDB+Redis
- `apps/sender/src/health/health.module.ts` - Providers reduced to Mongo+Redis only
- `apps/notifier/src/health/health.controller.ts` - Uses foundation RabbitMqHealthIndicator
- `apps/notifier/src/health/health.module.ts` - Imports RabbitMqHealthIndicator from foundation
- `apps/notifier/src/health/rabbitmq-health.indicator.ts` - DELETED (replaced by foundation)

## Decisions Made
- Liveness probes return `this.health.check([])` -- no heap check prevents unnecessary pod restarts under memory pressure
- Each service readiness checks only its actual infrastructure dependencies (not all three)
- Notifier local RabbitMQHealthIndicator deleted in favor of foundation RabbitMqHealthIndicator which uses correct terminus 11.x HealthIndicatorService pattern

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 5 backend services have correct health probes
- Ready for 06-03 (gateway health or any remaining health-resilience work)

## Self-Check: PASSED

All 10 modified files verified present. Deleted file confirmed absent. Both task commits (50d4d4f, b4a7856) found in git log.

---
*Phase: 06-health-resilience*
*Completed: 2026-04-02*
