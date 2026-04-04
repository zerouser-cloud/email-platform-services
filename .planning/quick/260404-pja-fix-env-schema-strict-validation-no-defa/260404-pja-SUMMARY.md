---
phase: quick
plan: 260404-pja
subsystem: config
tags: [zod, env-validation, 12-factor, proto, grpc]

requires:
  - phase: 15
    provides: CORS_STRICT env var and Zod schema
provides:
  - Fixed CORS_STRICT boolean parsing (string transform instead of coerce)
  - Required PROTO_DIR in env schema (fail-fast at boot)
  - Simplified proto-resolver with no fallback logic
affects: [all services via loadGlobalConfig, gateway CORS behavior]

tech-stack:
  added: []
  patterns: [z.string().transform() for string-to-boolean env vars]

key-files:
  created: []
  modified:
    - packages/config/src/env-schema.ts
    - packages/foundation/src/grpc/proto-resolver.ts
    - packages/foundation/src/grpc/grpc-server.factory.ts
    - packages/foundation/src/grpc/grpc-client.module.ts
    - .env.example

key-decisions:
  - "z.string().transform(v => v === 'true') instead of z.coerce.boolean() to avoid Boolean('false')===true"
  - "PROTO_DIR required with no default -- 12-Factor fail-fast on missing config"

patterns-established:
  - "Boolean env vars: use z.string().transform() not z.coerce.boolean()"

requirements-completed: []

duration: 2min
completed: 2026-04-04
---

# Quick Fix 260404-pja: Env Schema Strict Validation Summary

**Fixed CORS_STRICT boolean coercion bug and made PROTO_DIR required with fail-fast validation**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-04T15:25:42Z
- **Completed:** 2026-04-04T15:27:39Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- Fixed CORS_STRICT=false being parsed as true (Boolean("false")===true bug)
- Made PROTO_DIR required in Zod schema -- app fails fast at boot if missing
- Removed dead CONTRACTS_PROTO_DIR fallback from proto-resolver
- Synced all env files to include both CORS_STRICT and PROTO_DIR

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix CORS_STRICT and PROTO_DIR in env-schema.ts** - `bbe26d7` (fix)
2. **Task 2: Simplify proto-resolver and make protoDir required** - `0a3fdc2` (fix)
3. **Task 3: Sync env files** - `5ebf819` (chore)

## Files Created/Modified
- `packages/config/src/env-schema.ts` - Fixed CORS_STRICT transform, made PROTO_DIR required
- `packages/foundation/src/grpc/proto-resolver.ts` - Removed fallback, simplified to direct protoDir usage
- `packages/foundation/src/grpc/grpc-server.factory.ts` - Made protoDir parameter required
- `packages/foundation/src/grpc/grpc-client.module.ts` - Added non-null assertion for PROTO_DIR
- `.env.example` - Updated PROTO_DIR comment and default value for local dev

## Decisions Made
- Used `z.string().transform(v => v === 'true')` pattern for boolean env vars -- only exact string "true" yields boolean true
- Made PROTO_DIR required (no default) per 12-Factor: config validated at boot, fail fast if missing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed grpc-client.module.ts type error**
- **Found during:** Task 2 (proto-resolver simplification)
- **Issue:** `configService.get<string>('PROTO_DIR')` returns `string | undefined`, but `resolveProtoPath` now requires `string`
- **Fix:** Added non-null assertion (`!`) since PROTO_DIR is guaranteed present by required schema validation
- **Files modified:** `packages/foundation/src/grpc/grpc-client.module.ts`
- **Verification:** Foundation package builds clean
- **Committed in:** `0a3fdc2` (part of Task 2 commit)

**2. [Rule 3 - Blocking] .env is gitignored, cannot commit**
- **Found during:** Task 3 (env file sync)
- **Issue:** .env is in .gitignore (correctly), so changes cannot be committed
- **Fix:** Updated .env locally (for developer's environment), committed only .env.example with corrected PROTO_DIR default and comments
- **Verification:** .env.example shows correct local dev path
- **Committed in:** `5ebf819` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both necessary for build success and git correctness. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## Known Stubs
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both config and foundation packages build clean
- All services will benefit from correct CORS_STRICT parsing at next deploy
- Developers should ensure their local .env has `PROTO_DIR=packages/contracts/proto`

---
*Plan: quick/260404-pja*
*Completed: 2026-04-04*
