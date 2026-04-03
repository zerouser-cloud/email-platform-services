# Phase 7: Logging, Security & Operations - Context

**Gathered:** 2026-04-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Logs are structured and useful for production aggregation. Production security is enforced via config validation. Services shut down cleanly on SIGTERM.

</domain>

<decisions>
## Implementation Decisions

### Structured Log Fields (LOG-01)
- **D-01:** Add base fields to every Pino log entry: `service` (from SERVICE.*.id), `environment` (from NODE_ENV), `instanceId` (crypto.randomUUID() generated once at process start).
- **D-02:** Base fields configured in `pinoHttp` config within LoggingModule's `forHttpAsync` and `forGrpcAsync` methods. Pass as `base` option to Pino.
- **D-03:** Service name passed as parameter to LoggingModule factory methods (each service knows its own name).

### Request/Response Timing (LOG-02)
- **D-04:** Create NestJS interceptor that logs `{ method, path, statusCode, durationMs }` for every HTTP request.
- **D-05:** For gRPC services, the existing `GrpcLoggingInterceptor` already handles this — verify it includes duration.
- **D-06:** HTTP timing interceptor added to gateway's LoggingModule (HTTP-facing service).

### Security (.env.example) (SEC-01)
- **D-07:** Phase 2 already implemented: Zod refine rejects CORS_ORIGINS=* in production, .env.example updated with safe defaults. Verify completeness and add any missing documentation.

### Graceful Shutdown (OPS-01)
- **D-08:** `enableShutdownHooks()` already called in all 6 main.ts files — keep as-is.
- **D-09:** Add `onModuleDestroy` to each service's main module with full stub close() calls for future connections (MongoDB, Redis, RabbitMQ close stubs). Log "shutting down [service]" on destroy.
- **D-10:** Gateway: drain HTTP server. gRPC services: drain gRPC connections. Notifier: close RabbitMQ subscriber. All via onModuleDestroy lifecycle hook.

### Claude's Discretion
- Exact interceptor implementation (NestJS standard pattern)
- Whether to add `onApplicationShutdown` in addition to `onModuleDestroy`
- Log format for timing interceptor (structured object vs message string)

</decisions>

<canonical_refs>
## Canonical References

### Logging
- `packages/foundation/src/logging/logging.module.ts` — LoggingModule with forHttpAsync/forGrpcAsync
- `packages/foundation/src/logging/grpc-logging.interceptor.ts` — Existing gRPC logging interceptor
- `packages/foundation/src/logging/correlation.interceptor.ts` — Correlation interceptor

### Security
- `packages/config/src/env-schema.ts` — Zod schema with NODE_ENV + CORS refine (Phase 2)
- `.env.example` — Safe defaults (Phase 2)

### Shutdown
- `apps/*/src/main.ts` — All 6 bootstrap files (enableShutdownHooks already called)
- `apps/*/src/*.module.ts` — Main modules (need onModuleDestroy)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `GrpcLoggingInterceptor` — already logs gRPC method calls with duration
- `LoggingModule.forHttpAsync()` / `forGrpcAsync()` — already accept ConfigService injection (Phase 2)
- `enableShutdownHooks()` — already in all main.ts

### Established Patterns
- NestJS interceptors implement `NestInterceptor` with `intercept(context, next)` 
- `@nestjs/terminus` for health (already wired)
- Pino `base` option for static fields per process

### Integration Points
- LoggingModule — add base fields to Pino config
- Each service module — add OnModuleDestroy lifecycle
- Gateway module — add HTTP timing interceptor

</code_context>

<specifics>
## Specific Ideas

- instanceId from crypto.randomUUID() at process start
- Full shutdown stubs with close() calls even though connections don't exist yet
- SEC-01 mostly done in Phase 2, just verify completeness

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-logging-security-operations*
*Context gathered: 2026-04-03*
