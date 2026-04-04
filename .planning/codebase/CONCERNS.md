# Codebase Concerns

**Analysis Date:** 2026-04-02

## Tech Debt

### Empty Microservice Controllers

**Issue:** Four microservice controllers (Auth, Sender, Parser, Audience) contain only empty stub classes with no actual handler implementations. These controllers exist but do not implement any gRPC service methods.

**Files:**
- `apps/auth/src/auth.controller.ts` (4 lines)
- `apps/sender/src/sender.controller.ts` (4 lines)
- `apps/parser/src/parser.controller.ts` (4 lines)
- `apps/audience/src/audience.controller.ts` (4 lines)

**Impact:** These services are running but not handling any actual requests. The service contracts in `packages/contracts/proto/` define extensive message types and RPC methods, but the handlers are not implemented. Callers will receive "not implemented" errors from gRPC.

**Fix approach:** Implement the actual RPC handler methods in each controller according to the protobuf definitions. Create corresponding service classes to encapsulate business logic. Update each controller to decorate methods with gRPC decorators (`@GrpcMethod`, `@GrpcStreamMethod`).

### Double-defined Generated Contract Types

**Issue:** Proto-generated TypeScript types are generated and committed in two locations, creating duplication and maintenance burden.

**Files:**
- `packages/contracts/src/generated/` (source location)
- `packages/contracts/generated/` (duplicate location)

**Examples:**
- `packages/contracts/src/generated/sender.ts` (1388 lines) + `packages/contracts/generated/sender.ts` (1373 lines)
- `packages/contracts/src/generated/audience.ts` (1022 lines) + `packages/contracts/generated/audience.ts` (1007 lines)

**Impact:** When proto files change, both locations must be regenerated. Risk of synchronization drift. Maintenance confusion about which is the "source of truth."

**Fix approach:** Move proto generation to single source location. Update build system to generate only to `packages/contracts/src/generated/` and remove `packages/contracts/generated/` entirely. Update imports across codebase if needed. Ensure proto generation runs as part of build pipeline.

### No Test Suite

**Issue:** No test files exist in the codebase. No Jest, Vitest, or other test framework configuration found.

**Files:** None (absence)

**Impact:** Zero test coverage across all services. No safeguard against regressions. Complex error handling logic, gRPC interceptors, deadline management, correlation IDs, and health checks are entirely untested. Risk is particularly high for:
- Error mapping in `packages/foundation/src/errors/grpc-to-http.filter.ts`
- Retry logic in `packages/foundation/src/resilience/retry-connect.ts`
- gRPC deadline interceptor in `packages/foundation/src/resilience/grpc-deadline.interceptor.ts`

**Fix approach:** Set up Jest or Vitest test framework. Create test structure mirroring source structure. Start with unit tests for foundation modules (error handling, logging, resilience). Add integration tests for microservice startup and health checks. Establish minimum coverage target (e.g., 70% for core modules).

## Known Bugs & Issues

### Metadata Array Access Without Safety Check

**Issue:** In `packages/foundation/src/logging/logging.module.ts` line 67, metadata header extraction accesses array element [0] without checking if the array is non-empty.

**Files:** `packages/foundation/src/logging/logging.module.ts` (line 67)

**Problematic code:**
```typescript
const id = metadata.get(HEADER.CORRELATION_ID)[0];
```

**Trigger:** When a gRPC request arrives without the correlation ID header set, `metadata.get()` returns an empty array, causing `[0]` to be `undefined`. This propagates as a correlation ID of type `unknown` instead of a string.

**Impact:** Logs may be associated with invalid/undefined correlation IDs, breaking traceability. Type safety is violated despite TypeScript.

**Workaround:** None currently. Requests without correlation headers get randomly generated IDs on fallback path, but the bug allows undefined to pass through.

**Fix approach:** Add safety check before array access:
```typescript
const id = metadata.get(HEADER.CORRELATION_ID)?.[0];
return (id as string) || crypto.randomUUID();
```

### Config Loading Called Multiple Times During Module Initialization

**Issue:** `loadGlobalConfig()` is called at module instantiation time (top-level in module files), not in service providers. This happens multiple times across different modules.

**Files:**
- `apps/gateway/src/gateway.module.ts` (line 7)
- `apps/auth/src/auth.module.ts` (line 7)
- `apps/sender/src/sender.module.ts` (line 7)
- `apps/parser/src/parser.module.ts` (line 7)
- `apps/audience/src/audience.module.ts` (line 7)
- `apps/notifier/src/notifier.module.ts` (line 6)
- `apps/gateway/src/health/health.controller.ts` (line 13)

**Impact:** Configuration is validated and parsed multiple times unnecessarily, adding startup latency. Configuration object is not injectable, making it hard to mock in tests. Each module loads independently without benefit of dependency injection.

**Fix approach:** Create a single global ConfigService provider. Inject it where needed. Call `loadGlobalConfig()` once during app initialization, validate, and provide via DI token.

## Security Considerations

### CORS Configuration Accepts Wildcard in Production

**Issue:** The CORS configuration in `apps/gateway/src/main.ts` accepts `*` (wildcard) as a valid origin via environment variable without additional restrictions.

**Files:** `apps/gateway/src/main.ts` (lines 19-24)

**Code:**
```typescript
app.enableCors({
  origin:
    config.CORS_ORIGINS === CORS.WILDCARD
      ? CORS.WILDCARD
      : config.CORS_ORIGINS.split(',').map((s) => s.trim()),
});
```

**Risk:** If `CORS_ORIGINS` is set to `*` in production, the gateway accepts requests from any origin. This enables CSRF attacks and allows any website to make authenticated requests on behalf of users. Default in `.env.example` is `*`.

**Current mitigation:** Helm chart or deployment config should set `CORS_ORIGINS` to explicit domains. Relying on environment variable configuration.

**Recommendations:**
1. Change default in `.env.example` to a restricted list (e.g., empty string)
2. Add validation to reject wildcard in production mode (`NODE_ENV=production` should reject `CORS_ORIGINS=*`)
3. Document security implications in README
4. Add pre-deployment check script

### MinIO Credentials Hardcoded in Docker Compose

**Issue:** MinIO root credentials are hardcoded in committed file.

**Files:** `infra/docker-compose.yml` (lines 190-191)

**Code:**
```yaml
environment:
  MINIO_ROOT_USER: minioadmin
  MINIO_ROOT_PASSWORD: minioadmin
```

**Risk:** Development credentials in the repository are insecure practice. If committed credentials are stolen (via git history), malicious actors gain storage access.

**Current mitigation:** These are development defaults only, not production credentials.

**Recommendations:**
1. Remove hardcoded credentials from docker-compose.yml
2. Use environment variable substitution: `${MINIO_ROOT_USER:-minioadmin}`
3. Document requirement to set environment variables before running
4. Add pre-commit hook to detect hardcoded secrets in YAML

### Unvalidated Error Messages in Exception Filters

**Issue:** Error messages from gRPC exceptions are passed through to HTTP responses without sanitization.

**Files:**
- `packages/foundation/src/errors/grpc-to-http.filter.ts` (lines 43-52)
- `packages/foundation/src/errors/rpc-exception.filter.ts` (lines 21-29)

**Risk:** If a service logs sensitive information in error messages (e.g., database connection strings, internal service URLs), those details leak to HTTP clients. Error messages are user-facing and should be sanitized.

**Recommendations:**
1. Define a safe set of error messages per status code
2. Map gRPC error messages to generic client-safe messages
3. Log original error details separately for debugging
4. Audit existing error messages for sensitive information

## Performance Bottlenecks

### Retry Configuration Uses Aggressive Exponential Backoff

**Issue:** Default retry configuration in `packages/foundation/src/resilience/retry-connect.ts` uses exponential backoff that can cause unnecessary delays during startup.

**Files:** `packages/foundation/src/resilience/retry-connect.ts` (lines 7-11)

**Code:**
```typescript
export const RETRY_DEFAULTS: RetryOptions = {
  maxRetries: 10,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};
```

**Problem:** On startup, if a dependent service is unavailable:
- Attempt 1: immediate
- Attempt 2: wait 1s
- Attempt 3: wait 2s
- Attempt 4: wait 4s
- Attempt 5: wait 8s
- Attempt 6: wait 16s
- Attempt 7: wait 30s (capped)
- Total wait for 10 retries: ~121 seconds (~2 minutes)

**Impact:** Slow startup in situations where services need to be restarted in sequence. Kubernetes probes may timeout before connection succeeds.

**Improvement path:**
1. Reduce `baseDelayMs` to 100-200ms
2. Reduce `maxRetries` to 5-6 with jitter
3. Add configurable retry options per service
4. Consider returning early if service reaches max attempts

### Health Check Timeout May Be Too Long or Too Short

**Issue:** Health check in `apps/gateway/src/health/health.controller.ts` checks 4 gRPC services sequentially with hardcoded timeout.

**Files:** `apps/gateway/src/health/health.controller.ts` (lines 46-59)

**Code:**
```typescript
readiness() {
  return this.health.check(
    GRPC_SERVICES.map(
      ({ key, url }) =>
        () =>
          this.grpc.checkService<GrpcOptions>(key, key, {
            url,
            timeout: HEALTH.CHECK_TIMEOUT,
```

**Problem:** 
- If a single service is slow, readiness probe hangs
- Timeout value not exposed in config (checking what value is used)
- Sequential checks mean worst case latency = 4x timeout
- Missing circuit breaker - doesn't fail fast if multiple services are down

**Improvement path:**
1. Expose `HEALTH_CHECK_TIMEOUT` as environment variable
2. Run health checks in parallel, not sequentially
3. Implement circuit breaker - fail immediately if >1 service is down
4. Cache health check results briefly (5-10 seconds) to avoid thundering herd

## Fragile Areas

### gRPC Service Implementation Contract Mismatch

**Files:**
- `packages/contracts/proto/auth.proto`
- `packages/contracts/proto/sender.proto`
- `packages/contracts/proto/parser.proto`
- `packages/contracts/proto/audience.proto`
- `apps/auth/src/auth.controller.ts`
- `apps/sender/src/sender.controller.ts`
- `apps/parser/src/parser.controller.ts`
- `apps/audience/src/audience.controller.ts`

**Why fragile:** The proto files define multiple RPC methods and complex message types, but controller implementations are empty stubs. If someone tries to call these services expecting functionality:
1. Requests will fail with "not implemented" errors
2. No validation of request/response messages
3. Easy to accidentally break contracts when implementing - no tests to verify
4. Breaking changes to protos won't be caught

**Safe modification:** 
- Do not modify proto files without implementing corresponding handlers
- Run proto generation in CI before tests
- Add integration tests that exercise each RPC method
- Add contract tests comparing generated code to runtime implementation

### Configuration Validation Happens Late

**Issue:** Configuration validation via Zod schema happens in `loadGlobalConfig()`, which is called after module instantiation.

**Files:**
- `packages/config/src/env-schema.ts`
- Multiple modules calling `loadGlobalConfig()` at top level

**Why fragile:** If a required environment variable is missing, the error occurs during module import, not during explicit initialization. This makes error messages harder to trace and can cause confusing startup failures.

**Safe modification:** Move all `loadGlobalConfig()` calls to async initialization functions in providers rather than module field declarations.

### Unimplemented Notifier Service Missing gRPC Support

**Issue:** The notifier service runs as an HTTP app using `LoggingModule.forHttp()` but other services use gRPC with `LoggingModule.forGrpc()`.

**Files:**
- `apps/notifier/src/notifier.module.ts` (line 11)
- `apps/notifier/src/main.ts`

**Why fragile:** Notifier is architecturally different:
- No gRPC definition
- No controller implementation
- No proto file
- No health check that verifies it

This becomes an orphan service if the platform needs to add gRPC inter-service communication for notifications. The pattern is inconsistent with other services.

**Safe modification:** Clarify the intended architecture for notifier. Either:
1. Add gRPC support and unify with other services, or
2. Document why notifier is HTTP-only and how it integrates with the system

## Scaling Limits

### Sequential Service Health Checks Block Readiness

**Current capacity:** Health check for gateway is synchronous, checking 4 services sequentially.

**Limit:** If any service takes >5 seconds to respond, the readiness check will timeout (Kubernetes default). If multiple services are slow, accumulated latency can exceed 20 seconds, causing pod eviction.

**Scaling path:** 
1. Parallelize health checks using `Promise.all()`
2. Add health check result caching to reduce probe frequency
3. Consider separate liveness/readiness logic

### Database/Cache Connections Not Pooled in Visible Config

**Current capacity:** Services depend on PostgreSQL, Redis, RabbitMQ, MinIO. PostgreSQL connection pooling is configured via pg.Pool (max 10, idle 30s, connect timeout 5s) in DrizzleModule.

**Limit:** Under high load, connection exhaustion may occur if:
- Services open new connections per request
- Connection timeouts are too long
- No connection pooling is configured

**Scaling path:** Expose connection pool configuration in environment variables. Document recommended pool sizes for expected load.

### No Request Rate Limiting Between Services

**Current capacity:** Gateway enforces rate limits, but inter-service gRPC communication is unlimited.

**Limit:** A single buggy service calling another service repeatedly could overwhelm it without triggering rate limits.

**Scaling path:** Add rate limiting or circuit breaker for inter-service calls.

## Dependencies at Risk

### gRPC and Proto-Related Dependencies

**Package:** `@grpc/grpc-js@^1.14.3`, `@grpc/proto-loader@^0.7.15`, `protobufjs@7.5.4`

**Risk:** gRPC JavaScript ecosystem moves slowly. Breaking changes require coordination across all services.

**Impact:** Upgrading requires testing all services end-to-end.

**Migration plan:** 
1. Monitor @grpc/grpc-js releases for security patches
2. Plan major version upgrades during low-traffic periods
3. Add integration tests that verify gRPC server/client compatibility after upgrades

### NestJS Monorepo at Version 11

**Package:** `@nestjs/common@^11.0.1`, `@nestjs/core@^11.0.1`, `@nestjs/microservices@^11.0.1`

**Risk:** NestJS 11 is recent (2024). Limited production deployments. Future minor versions may have breaking changes.

**Impact:** If critical bugs are found in v11, limited workarounds exist.

**Migration plan:** Monitor NestJS releases. Consider staying 1-2 versions behind latest for production stability.

### Turbo Monorepo Manager at 2.8.14

**Package:** `turbo@^2.8.14`

**Risk:** Turbo is relatively new in this ecosystem. Task execution order could change in minor versions.

**Impact:** Build order could become non-deterministic between versions.

**Migration plan:** Pin exact version or use narrow semver range (e.g., `~2.8.14`) instead of `^2.8.14`.

## Missing Critical Features

### No Structured Logging for Operational Insights

**Issue:** While Pino is integrated, only correlation IDs are logged. No structured fields for service name, deployment environment, instance ID, or request duration.

**Files:** `packages/foundation/src/logging/logging.module.ts`

**Problem:** Logs are difficult to filter and correlate in production without essential operational fields.

**Recommendations:**
1. Add environment (dev/staging/prod) to all logs
2. Add service name to all logs
3. Add request/response timing information
4. Add error severity levels (transient vs. fatal)

### No API Documentation

**Issue:** gRPC services have protobuf definitions but no OpenAPI/Swagger documentation for the gateway HTTP endpoints.

**Files:** None

**Impact:** Consumers cannot discover API contracts. No machine-readable API spec.

**Recommendations:**
1. Add `@nestjs/swagger` for HTTP endpoints
2. Generate OpenAPI spec from gateway controllers
3. Document gRPC service contracts in README

### No Distributed Tracing

**Issue:** Correlation IDs are logged but there is no integration with distributed tracing systems (e.g., Jaeger, Datadog).

**Files:** None

**Impact:** Cannot visualize request flow across microservices. Impossible to debug latency issues without manual log correlation.

**Recommendations:**
1. Integrate OpenTelemetry
2. Export traces to Jaeger or compatible backend
3. Connect trace context to gRPC calls

## Test Coverage Gaps

### Foundation Modules Completely Untested

**What's not tested:**
- `packages/foundation/src/errors/grpc-to-http.filter.ts` - Error mapping logic
- `packages/foundation/src/errors/rpc-exception.filter.ts` - Exception handling
- `packages/foundation/src/errors/grpc-exceptions.ts` - Custom exception classes
- `packages/foundation/src/resilience/retry-connect.ts` - Retry logic and backoff
- `packages/foundation/src/resilience/grpc-deadline.interceptor.ts` - Deadline propagation
- `packages/foundation/src/logging/` - All logging, correlation ID handling, gRPC interceptors

**Files:** All foundation modules (entire `packages/foundation/src/` directory)

**Risk:** 
- Error handling bugs go undetected
- Retry behavior may fail under specific conditions
- Correlation IDs may not propagate correctly
- Logging may not include necessary context

**Priority:** HIGH - These modules are foundational and used by all services

### Microservice Startup and Configuration Not Tested

**What's not tested:**
- Service bootstrap and gRPC server initialization
- Configuration loading and validation
- Health check endpoints
- Rate limiting/throttling
- Graceful shutdown

**Files:**
- `apps/*/src/main.ts`
- `apps/gateway/src/gateway.module.ts`
- `apps/gateway/src/throttle/throttle.module.ts`
- `apps/gateway/src/health/health.controller.ts`

**Risk:** Services may fail to start in production with configuration not caught in development.

**Priority:** HIGH - Startup failures block deployments

---

*Concerns audit: 2026-04-02*
