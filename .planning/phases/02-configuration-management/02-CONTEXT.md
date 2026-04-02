# Phase 2: Configuration Management - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Configuration loads once at application bootstrap and is injected via NestJS DI. No module-scope side effects. Environment-aware validation rejects dangerous values in production. No hardcoded secrets in committed files.

</domain>

<decisions>
## Implementation Decisions

### Config DI Refactor
- **D-01:** Remove all direct `loadGlobalConfig()` calls from module files (*.module.ts). Replace with NestJS `ConfigService` injection. `loadGlobalConfig()` stays ONLY in `main.ts` for bootstrap (before NestJS DI is available) and in `AppConfigModule` (the DI bridge).
- **D-02:** `AppConfigModule` already exists with correct setup (`ConfigModule.forRoot({ load: [loadGlobalConfig], isGlobal: true, cache: true })`). Keep it as-is. It's the single entry point for config into NestJS DI.
- **D-03:** `GrpcClientModule` in foundation calls `loadGlobalConfig()` directly. Refactor to accept config via module options or inject ConfigService.
- **D-04:** `ThrottleModule` in gateway calls `loadGlobalConfig()` directly. Refactor to use ConfigService via async factory.
- **D-05:** `HealthController` in gateway calls `loadGlobalConfig()`. Refactor to inject ConfigService.

### CORS Production Validation
- **D-06:** Add `NODE_ENV` field to Zod schema (with default 'development').
- **D-07:** Add `.refine()` to GlobalEnvSchema: if `NODE_ENV === 'production'`, `CORS_ORIGINS` cannot be `*`. Fails at startup with clear error message.
- **D-08:** Update `.env.example` with safe CORS default and comment explaining production requirements.

### Docker Compose Secrets
- **D-09:** Replace hardcoded MinIO credentials in `infra/docker-compose.yml` with `${MINIO_ROOT_USER:-minioadmin}` and `${MINIO_ROOT_PASSWORD:-minioadmin}` env var substitution.

### Claude's Discretion
- Exact ConfigService getter patterns (typed getters vs generic `get()`)
- How to handle `GrpcClientModule` — module options pattern vs direct injection
- Whether to add other env-aware validations beyond CORS (e.g., require explicit MongoDB URI in production)
- `.env.example` comment formatting

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Config system
- `packages/config/src/config-loader.ts` — `loadGlobalConfig()` with caching, the function being refactored away from module-level usage
- `packages/config/src/app-config.module.ts` — Existing `AppConfigModule` with `ConfigModule.forRoot()` — the correct DI bridge
- `packages/config/src/env-schema.ts` — Zod schema for env validation, where CORS refine will be added
- `packages/config/src/index.ts` — Barrel exports from config package

### Files to refactor (all call loadGlobalConfig at module scope)
- `apps/auth/src/auth.module.ts`
- `apps/sender/src/sender.module.ts`
- `apps/parser/src/parser.module.ts`
- `apps/audience/src/audience.module.ts`
- `apps/notifier/src/notifier.module.ts`
- `apps/gateway/src/gateway.module.ts`
- `apps/gateway/src/throttle/throttle.module.ts`
- `apps/gateway/src/health/health.controller.ts`
- `packages/foundation/src/grpc/grpc-client.module.ts`

### main.ts files (loadGlobalConfig stays here for bootstrap)
- `apps/auth/src/main.ts`
- `apps/sender/src/main.ts`
- `apps/parser/src/main.ts`
- `apps/audience/src/main.ts`
- `apps/notifier/src/main.ts`
- `apps/gateway/src/main.ts`

### Docker secrets
- `infra/docker-compose.yml` — Lines 190-191 have hardcoded MinIO credentials

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AppConfigModule` — Already correctly configured, no changes needed. Other modules just need to import it (most already do).
- `ConfigModule.forRoot()` with `isGlobal: true` — means ConfigService is available everywhere without re-importing.

### Established Patterns
- NestJS `ConfigService` from `@nestjs/config` — standard injection pattern
- `loadGlobalConfig()` has internal caching via `cachedConfig` — so multiple calls don't re-parse, but they still bypass DI
- Zod schema validation at parse time — good place for refine()

### Integration Points
- `GrpcClientModule.register()` in foundation takes service declarations and needs config for gRPC addresses — needs async module pattern
- `ThrottleModule` uses `ThrottlerModule.forRootAsync()` — already async, just needs ConfigService injection
- Every `main.ts` bootstraps with `loadGlobalConfig()` for pre-DI setup (port, gRPC options) — this stays

</code_context>

<specifics>
## Specific Ideas

- User wants full DI approach through ConfigService, not minimal fix
- Zod refine for CORS validation (not runtime guard) — fails at startup
- MinIO credentials via env var substitution with defaults

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-configuration-management*
*Context gathered: 2026-04-02*
