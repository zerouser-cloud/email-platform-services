---
phase: 03-error-handling-safety
plan: 02
subsystem: api
tags: [nestjs, correlation-id, error-handling, cls, request-tracing]

# Dependency graph
requires:
  - phase: 03-error-handling-safety/01
    provides: Safe error message mapping via ERROR_CODE_TO_MESSAGE in GrpcToHttpExceptionFilter
provides:
  - Unified error response shape with correlationId and timestamp on all HTTP error paths
  - ClsService injection in GrpcToHttpExceptionFilter
affects: [gateway, error-handling, observability]

# Tech tracking
tech-stack:
  added: []
  patterns: [unified-error-response-shape, cls-correlation-in-errors]

key-files:
  created: []
  modified:
    - packages/foundation/src/errors/grpc-to-http.filter.ts

key-decisions:
  - "Added timestamp field to error responses alongside correlationId for debugging aid"
  - "Fallback to 'no-correlation-id' when CLS context unavailable (startup errors, non-request contexts)"

patterns-established:
  - "Unified error shape: { statusCode, message, error, correlationId, timestamp } on all HTTP error paths"
  - "HttpException.getResponse() typeof check for string vs object body handling"

requirements-completed: [ERR-03]

# Metrics
duration: 1min
completed: 2026-04-02
---

# Phase 03 Plan 02: CorrelationId in Error Responses Summary

**ClsService-injected correlationId and timestamp on all HTTP error responses with string/object HttpException body handling**

## Performance

- **Duration:** 1 min
- **Started:** 2026-04-02T13:24:36Z
- **Completed:** 2026-04-02T13:25:31Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Every HTTP error response now includes correlationId from CLS request context
- Both gRPC-mapped errors and HttpException passthrough paths produce unified shape
- HttpException.getResponse() correctly handles both string and object return types
- Timestamp added to all error responses for debugging correlation

## Task Commits

Each task was committed atomically:

1. **Task 1: Inject ClsService and add correlationId to all error responses** - `a1c13d4` (feat)

## Files Created/Modified
- `packages/foundation/src/errors/grpc-to-http.filter.ts` - Added ClsService injection, correlationId and timestamp to both gRPC and HttpException error response paths

## Decisions Made
- Added `timestamp: new Date().toISOString()` to both error paths (plan discretion item) -- standard NestJS practice, aids debugging alongside correlationId
- Used `'no-correlation-id'` fallback string when `cls.getId()` returns undefined -- handles startup errors and edge cases where CLS context is not initialized

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 03 error-handling-safety is now complete (both plans executed)
- All HTTP error responses follow unified shape with correlationId for request tracing
- Ready for next phase of foundation audit

## Self-Check: PASSED

- FOUND: packages/foundation/src/errors/grpc-to-http.filter.ts
- FOUND: .planning/phases/03-error-handling-safety/03-02-SUMMARY.md
- FOUND: commit a1c13d4

---
*Phase: 03-error-handling-safety*
*Completed: 2026-04-02*
