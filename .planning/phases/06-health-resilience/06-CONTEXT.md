# Phase 6: Health & Resilience - Context

**Gathered:** 2026-04-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Health checking is fast, reliable, and Kubernetes-ready. Retry behavior is reasonable and configurable. Every service checks its own dependencies in readiness probes.

</domain>

<decisions>
## Implementation Decisions

### Parallel Health Checks (HLTH-01)
- **D-01:** Gateway readiness currently runs gRPC health checks sequentially (array of thunks to `health.check()`). Refactor to run them in parallel via `Promise.all()` — wrap the gRPC checks and feed aggregated result to terminus.
- **D-02:** Timeout per check stays at `HEALTH.CHECK_TIMEOUT` (3000ms). Parallel execution means worst case = 3s, not 4x3s=12s.

### Tuned Retry (HLTH-02)
- **D-03:** Change defaults: `maxRetries: 5, baseDelayMs: 200, maxDelayMs: 5000`. Total worst case ~10s instead of ~2min.
- **D-04:** Add jitter to prevent thundering herd: `delay = Math.min(baseDelayMs * 2^attempt, maxDelayMs) + random(0, baseDelayMs)`.
- **D-05:** Make configurable via env vars: `RETRY_MAX_RETRIES`, `RETRY_BASE_DELAY_MS`, `RETRY_MAX_DELAY_MS`. Fallback to new defaults if not set.
- **D-06:** Add env vars to `.env.example` with documentation.

### Liveness vs Readiness (HLTH-03)
- **D-07:** Liveness (`/health/live`): simplified — always returns 200 if process is running. Remove heap check (prevents unnecessary pod restarts on temporary memory spikes).
- **D-08:** Readiness (`/health/ready`): full dependency check per service:
  - **auth**: MongoDB connection
  - **sender**: MongoDB + Redis connections
  - **parser**: MongoDB connection
  - **audience**: MongoDB connection
  - **notifier**: RabbitMQ connection (indicator already created in Phase 5)
  - **gateway**: all 4 gRPC services (parallel, per D-01)
- **D-09:** Use `@nestjs/terminus` health indicators: `MongooseHealthIndicator` (or custom MongoDB check), `MicroserviceHealthIndicator` for Redis, existing `RabbitMQHealthIndicator` for notifier.
- **D-10:** Each service's `health.controller.ts` and `health.module.ts` updated. Health modules need providers for the indicators.

### Claude's Discretion
- Whether to use `MongooseHealthIndicator` from terminus or custom MongoDB ping check (since we use native MongoDB driver, not Mongoose)
- Exact indicator class names and file organization within health/ directories
- Whether to add memory heap back as a readiness indicator (recommendation: no, keep it simple)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Health system
- `apps/gateway/src/health/health.controller.ts` — Gateway health controller (readiness checks gRPC services sequentially)
- `apps/gateway/src/health/health.module.ts` — Gateway health module
- `packages/foundation/src/health/health-constants.ts` — HEALTH constants (ROUTE, LIVE, READY, timeouts)
- `apps/notifier/src/health/rabbitmq-health.indicator.ts` — RabbitMQ indicator (Phase 5)

### Per-service health controllers (to be updated)
- `apps/auth/src/health/health.controller.ts`
- `apps/sender/src/health/health.controller.ts`
- `apps/parser/src/health/health.controller.ts`
- `apps/audience/src/health/health.controller.ts`
- `apps/notifier/src/health/health.controller.ts`

### Retry system
- `packages/foundation/src/resilience/retry-connect.ts` — Current retry with aggressive defaults

### Config
- `.env.example` — For new retry env vars

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@nestjs/terminus` already installed — provides HealthCheckService, MemoryHealthIndicator, GRPCHealthIndicator
- `RabbitMQHealthIndicator` already created for notifier (Phase 5)
- `retryConnect()` function — clean, just needs default changes + jitter + env var support
- `HEALTH` constants in foundation — centralized

### Established Patterns
- Health controllers use `@HealthCheck()` decorator + `this.health.check([...])` pattern
- Each service already has `health/health.controller.ts` and `health/health.module.ts`
- ConfigService injectable everywhere (Phase 2)

### Integration Points
- Each service's health module — needs new providers (MongoDB/Redis indicators)
- `retry-connect.ts` — needs env var reading (via ConfigService or process.env since it's used before DI)
- `.env` / `.env.example` — new retry variables
- Docker compose healthcheck commands may reference health endpoints

</code_context>

<specifics>
## Specific Ideas

- Parallel health checks via Promise.all in gateway
- Retry: 5 attempts, 200ms base, 5s max, with jitter
- Liveness: always 200 (no heap check)
- Readiness: each service checks its own DB/Redis/RabbitMQ dependencies
- Configurable retry via env vars

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-health-resilience*
*Context gathered: 2026-04-02*
