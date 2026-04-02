# Phase 6: Health & Resilience - Research

**Researched:** 2026-04-02
**Domain:** NestJS health checks (@nestjs/terminus), retry/resilience patterns, Kubernetes probe design
**Confidence:** HIGH

## Summary

Phase 6 transforms the existing health check stubs into production-ready liveness/readiness probes and tunes the retry-connect utility to sane defaults. The codebase already has the correct structure in place: every service has `health.controller.ts` and `health.module.ts`, foundation exports three health indicators (`MongoHealthIndicator`, `RedisHealthIndicator`, `RabbitMqHealthIndicator`), and `@nestjs/terminus` 11.1.1 is installed. The indicators are currently stubs returning `up({ message: HEALTH.STUB_MESSAGE })` -- they need real connection checks. The gateway runs gRPC checks sequentially and needs `Promise.all()` parallelization. The retry utility has aggressive defaults (10 retries, 1s base, 30s max ~2min worst case) and needs tuning plus jitter.

Key observation: all four backend service health controllers (auth, sender, parser, audience) import and inject all three indicators (Mongo, Redis, RabbitMQ) regardless of whether the service actually uses that dependency. Per D-08, each service should only check its own dependencies. The notifier already has the correct pattern -- it only checks RabbitMQ.

**Primary recommendation:** Work in three waves: (1) tune retry-connect defaults + jitter + env vars, (2) fix per-service readiness to check only actual dependencies + simplify liveness, (3) parallelize gateway gRPC checks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Gateway readiness currently runs gRPC health checks sequentially. Refactor to run them in parallel via `Promise.all()` -- wrap the gRPC checks and feed aggregated result to terminus.
- **D-02:** Timeout per check stays at `HEALTH.CHECK_TIMEOUT` (3000ms). Parallel execution means worst case = 3s, not 4x3s=12s.
- **D-03:** Change defaults: `maxRetries: 5, baseDelayMs: 200, maxDelayMs: 5000`. Total worst case ~10s instead of ~2min.
- **D-04:** Add jitter to prevent thundering herd: `delay = Math.min(baseDelayMs * 2^attempt, maxDelayMs) + random(0, baseDelayMs)`.
- **D-05:** Make configurable via env vars: `RETRY_MAX_RETRIES`, `RETRY_BASE_DELAY_MS`, `RETRY_MAX_DELAY_MS`. Fallback to new defaults if not set.
- **D-06:** Add env vars to `.env.example` with documentation.
- **D-07:** Liveness (`/health/live`): simplified -- always returns 200 if process is running. Remove heap check.
- **D-08:** Readiness (`/health/ready`): full dependency check per service: auth=MongoDB, sender=MongoDB+Redis, parser=MongoDB, audience=MongoDB, notifier=RabbitMQ, gateway=4 gRPC services (parallel).
- **D-09:** Use `@nestjs/terminus` health indicators: custom MongoDB ping check (no Mongoose), `MicroserviceHealthIndicator` for Redis, existing `RabbitMQHealthIndicator` for notifier.
- **D-10:** Each service's `health.controller.ts` and `health.module.ts` updated. Health modules need providers for the indicators.

### Claude's Discretion
- Whether to use `MongooseHealthIndicator` from terminus or custom MongoDB ping check (since we use native MongoDB driver, not Mongoose) -- **Recommendation: custom ping, see Architecture Patterns below**
- Exact indicator class names and file organization within health/ directories
- Whether to add memory heap back as a readiness indicator -- **Recommendation: no, keep it simple per D-07**

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HLTH-01 | Gateway checks gRPC services in parallel via `Promise.all()` | Gateway health controller pattern with Promise.all wrapping terminus checks; see Architecture Pattern 1 |
| HLTH-02 | Retry configuration tuned to reasonable values, configurable via env vars | retry-connect.ts modifications: new defaults, jitter formula, process.env reading; see Architecture Pattern 3 |
| HLTH-03 | Separate liveness (process alive) and readiness (dependencies ready) probe endpoints | Per-service indicator mapping, simplified liveness; see Architecture Pattern 2 |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @nestjs/terminus | 11.1.1 | Health check framework | Already installed; provides HealthCheckService, HealthIndicatorService, decorators |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nestjs/config | 4.0.3 | ConfigService for env vars | Already available in all services for retry env var reading |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom MongoHealthIndicator | MongooseHealthIndicator from terminus | Project uses native MongoDB driver, not Mongoose. MongooseHealthIndicator requires Mongoose connection object. Custom is correct. |
| Custom Redis check | @nestjs/terminus built-in | No built-in Redis indicator in terminus 11.x. Custom stub already exists. |

**No new packages needed.** All required dependencies are already installed.

## Architecture Patterns

### Current State Inventory

All six services have `health/health.controller.ts` and `health/health.module.ts`. Three foundation indicators exist as stubs:

| Indicator | Location | Status |
|-----------|----------|--------|
| `MongoHealthIndicator` | `packages/foundation/src/health/indicators/mongodb.health.ts` | Stub (returns up with STUB_MESSAGE) |
| `RedisHealthIndicator` | `packages/foundation/src/health/indicators/redis.health.ts` | Stub (returns up with STUB_MESSAGE) |
| `RabbitMqHealthIndicator` | `packages/foundation/src/health/indicators/rabbitmq.health.ts` | Stub (returns up with STUB_MESSAGE) |
| `RabbitMQHealthIndicator` | `apps/notifier/src/health/rabbitmq-health.indicator.ts` | Phase 5 stub (different class, extends HealthIndicator) |

**Important naming conflict:** Foundation exports `RabbitMqHealthIndicator` (camelCase). Notifier has local `RabbitMQHealthIndicator` (uppercase). The notifier should switch to use the foundation version for consistency.

### Per-Service Dependency Map (from D-08)

| Service | Dependencies to Check | Current State | Action |
|---------|----------------------|---------------|--------|
| auth | MongoDB | Injects Mongo + Redis + RabbitMQ (wrong) | Remove Redis, RabbitMQ from module and controller |
| sender | MongoDB, Redis | Injects Mongo + Redis + RabbitMQ (wrong) | Remove RabbitMQ from module and controller |
| parser | MongoDB | Injects Mongo + Redis + RabbitMQ (wrong) | Remove Redis, RabbitMQ from module and controller |
| audience | MongoDB | Injects Mongo + Redis + RabbitMQ (wrong) | Remove Redis, RabbitMQ from module and controller |
| notifier | RabbitMQ | Uses local RabbitMQHealthIndicator (correct deps, wrong source) | Switch to foundation indicator |
| gateway | 4 gRPC services | Sequential checks (correct deps, wrong execution) | Parallelize with Promise.all |

### Pattern 1: Parallel gRPC Health Checks (Gateway)

**What:** Run all 4 gRPC health checks concurrently, then feed aggregated result to terminus.
**When to use:** Gateway readiness endpoint.

The current gateway readiness passes an array of thunks to `this.health.check([...])`. Terminus executes these sequentially. To parallelize, run the gRPC checks independently via `Promise.all()` and construct a terminus-compatible response.

```typescript
// Gateway health controller - parallel gRPC checks
@Get(HEALTH.READY)
@HealthCheck()
async readiness() {
  // Run all gRPC checks in parallel
  const results = await Promise.all(
    this.grpcServices.map(({ key, url }) =>
      this.grpc.checkService<GrpcOptions>(key, key, {
        url,
        timeout: HEALTH.CHECK_TIMEOUT,
        healthServiceCheck: checkOverallHealth,
      }),
    ),
  );

  // health.check() accepts indicator functions -- wrap pre-resolved results
  return this.health.check(
    results.map((result) => () => result),
  );
}
```

**Key detail:** `GRPCHealthIndicator.checkService()` returns a Promise that resolves to `HealthIndicatorResult` or throws `HealthCheckError`. By awaiting all via `Promise.all()`, we get parallel execution. We then wrap each resolved result in a thunk for `health.check()` to aggregate.

**Caveat:** If one service is down, `Promise.all()` will reject immediately. Use `Promise.allSettled()` if partial results are desired. However, terminus `health.check()` already handles individual indicator failures gracefully when they throw -- so `Promise.all` with try/catch per check or using `Promise.allSettled` with re-throwing on failure both work. The simpler approach is `Promise.allSettled` + building a combined result.

### Pattern 2: Simplified Liveness

**What:** Liveness returns 200 unconditionally (process is alive).
**When to use:** All services.

```typescript
@Get(HEALTH.LIVE)
@HealthCheck()
liveness() {
  return this.health.check([]);
}
```

An empty check array returns `{ status: 'ok', info: {}, error: {}, details: {} }` with HTTP 200. This is the simplest approach and satisfies D-07 (no heap check, no dependency checks).

### Pattern 3: Retry with Jitter and Env Vars

**What:** Update `retryConnect()` with tuned defaults, jitter, and env var override.
**When to use:** Foundation resilience utility.

```typescript
export const RETRY_DEFAULTS: RetryOptions = {
  maxRetries: 5,       // was 10
  baseDelayMs: 200,    // was 1000
  maxDelayMs: 5000,    // was 30000
};

function getRetryConfig(options?: Partial<RetryOptions>): RetryOptions {
  return {
    maxRetries: options?.maxRetries
      ?? parseInt(process.env.RETRY_MAX_RETRIES ?? '', 10)
      || RETRY_DEFAULTS.maxRetries,
    baseDelayMs: options?.baseDelayMs
      ?? parseInt(process.env.RETRY_BASE_DELAY_MS ?? '', 10)
      || RETRY_DEFAULTS.baseDelayMs,
    maxDelayMs: options?.maxDelayMs
      ?? parseInt(process.env.RETRY_MAX_DELAY_MS ?? '', 10)
      || RETRY_DEFAULTS.maxDelayMs,
  };
}
```

**Jitter formula (D-04):**
```typescript
const delay = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs)
  + Math.floor(Math.random() * baseDelayMs);
```

**Why process.env instead of ConfigService:** `retryConnect` is a standalone utility function, not a NestJS injectable. It may be called before DI container is initialized (e.g., in bootstrap). Using `process.env` directly is correct here.

### Pattern 4: MongoDB Ping Check (Custom, No Mongoose)

**What:** The project uses native MongoDB driver, not Mongoose. The foundation `MongoHealthIndicator` needs a real ping check.
**Challenge:** Since no MongoDB connection is wired yet (STACK.md says "MongoDB client: Not yet integrated"), the indicator will remain a stub but should be structured for future connection injection.

**Recommended approach:** Accept a `MongoClient` or connection getter via constructor injection. For now, keep the stub behavior but add the structure.

```typescript
@Injectable()
export class MongoHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Optional() @Inject('MONGO_CONNECTION') private readonly db?: Db,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    if (!this.db) {
      return indicator.up({ message: HEALTH.STUB_MESSAGE });
    }
    try {
      await this.db.command({ ping: 1 });
      return indicator.up();
    } catch {
      throw new HealthCheckError('MongoDB check failed', indicator.down());
    }
  }
}
```

**Discretion recommendation:** Keep all three indicators as stubs with `STUB_MESSAGE` since DB/Redis/RabbitMQ connections are not yet wired. Structure them to accept optional injected connections so they're ready when connections are added. This matches the project constraint "without business logic -- only structural framework."

### Anti-Patterns to Avoid
- **Injecting all indicators everywhere:** Auth does not use Redis or RabbitMQ. Only inject and check actual dependencies per D-08.
- **Heap check in liveness:** Per D-07, heap checks cause unnecessary pod restarts on temporary spikes. Liveness should be trivial.
- **Sequential gRPC checks in gateway:** Current pattern results in O(n) latency. Must be parallel per D-01.
- **ConfigService in retryConnect:** This is a standalone utility, not a NestJS provider. Use `process.env` directly.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Health check aggregation | Custom HTTP endpoint returning JSON | `@nestjs/terminus` HealthCheckService | Handles status codes, error aggregation, standard format |
| gRPC health check protocol | Custom gRPC ping implementation | `GRPCHealthIndicator` from terminus | Implements standard gRPC health check protocol |
| Health indicator base class | Custom status formatting | `HealthIndicatorService` from terminus 11.x | Provides `.check(key).up()/.down()` pattern |
| Exponential backoff | Raw setTimeout loops | `retryConnect()` from foundation | Already exists, just needs tuning |

**Key insight:** The terminus framework already provides the aggregation, status code mapping, and response formatting. Focus on writing indicator logic, not framework plumbing.

## Common Pitfalls

### Pitfall 1: Promise.all Fast-Fail on gRPC Checks
**What goes wrong:** If one gRPC service is down, `Promise.all()` rejects immediately, skipping checks for remaining services. The readiness response only shows the first failure.
**Why it happens:** `Promise.all()` short-circuits on first rejection.
**How to avoid:** Use `Promise.allSettled()` to collect all results, then construct the terminus response from both fulfilled and rejected outcomes. This gives operators visibility into which specific services are down.
**Warning signs:** Readiness showing only one failure when multiple services are down.

### Pitfall 2: Env Var Parsing Edge Cases
**What goes wrong:** `parseInt('', 10)` returns `NaN`, `parseInt('0', 10)` returns `0` which is falsy.
**Why it happens:** Using `||` fallback treats `0` as falsy, and `NaN` propagates.
**How to avoid:** Use explicit `isNaN` checks or the `??` operator with proper parseInt handling. For retry values, 0 is never valid, so `|| DEFAULTS` is safe for this specific case.
**Warning signs:** Retry config silently ignoring valid env var values.

### Pitfall 3: HealthIndicator vs HealthIndicatorService API Confusion
**What goes wrong:** Mixing terminus 10.x pattern (`extends HealthIndicator`) with 11.x pattern (`inject HealthIndicatorService`).
**Why it happens:** Many online examples show the old `extends HealthIndicator` base class pattern. Terminus 11.x introduced `HealthIndicatorService` as the recommended approach.
**How to avoid:** The foundation indicators already use the 11.x `HealthIndicatorService` pattern. The notifier's local `RabbitMQHealthIndicator` still uses the old `extends HealthIndicator` pattern from Phase 5.
**Warning signs:** `HealthIndicator` import from terminus (old pattern) vs `HealthIndicatorService` injection (new pattern).

### Pitfall 4: Notifier Dual RabbitMQ Indicator
**What goes wrong:** Two RabbitMQ indicators exist with different names, patterns, and locations.
**Why it happens:** Phase 5 created a local notifier indicator before foundation indicators existed.
**How to avoid:** Consolidate to use the foundation `RabbitMqHealthIndicator` in the notifier, removing the local `rabbitmq-health.indicator.ts`.
**Warning signs:** Import from local `./rabbitmq-health.indicator` instead of `@email-platform/foundation`.

### Pitfall 5: Zod Schema Must Include New Env Vars
**What goes wrong:** New `RETRY_*` env vars fail Zod validation if added as required fields, since they may not be set in all environments.
**Why it happens:** `GlobalEnvSchema` validates all env vars at startup.
**How to avoid:** `retryConnect` reads `process.env` directly with fallback defaults, so these vars do NOT need to be in the Zod schema. They are optional overrides. Just add them to `.env.example` with comments per D-06. Do NOT add them to `env-schema.ts`.
**Warning signs:** Services failing to start because RETRY_* vars are not set.

## Code Examples

### Current Gateway Readiness (Sequential -- To Be Replaced)
```typescript
// Source: apps/gateway/src/health/health.controller.ts (lines 47-59)
readiness() {
  return this.health.check(
    this.grpcServices.map(
      ({ key, url }) =>
        () =>
          this.grpc.checkService<GrpcOptions>(key, key, {
            url,
            timeout: HEALTH.CHECK_TIMEOUT,
            healthServiceCheck: checkOverallHealth,
          }),
    ),
  );
}
```

### Current Retry Defaults (To Be Tuned)
```typescript
// Source: packages/foundation/src/resilience/retry-connect.ts (lines 7-11)
export const RETRY_DEFAULTS: RetryOptions = {
  maxRetries: 10,      // change to 5
  baseDelayMs: 1000,   // change to 200
  maxDelayMs: 30000,   // change to 5000
};
```

### Current Auth Health Module (Injects Too Many Indicators)
```typescript
// Source: apps/auth/src/health/health.module.ts (lines 1-15)
// Auth only needs MongoDB, but injects Mongo + Redis + RabbitMQ
@Module({
  imports: [TerminusModule],
  controllers: [HealthController],
  providers: [MongoHealthIndicator, RedisHealthIndicator, RabbitMqHealthIndicator],
})
export class HealthModule {}
```

### Foundation Indicator Stub Pattern (11.x API)
```typescript
// Source: packages/foundation/src/health/indicators/mongodb.health.ts
@Injectable()
export class MongoHealthIndicator {
  constructor(private readonly healthIndicatorService: HealthIndicatorService) {}
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    return indicator.up({ message: HEALTH.STUB_MESSAGE });
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `extends HealthIndicator` | `inject HealthIndicatorService` | terminus 11.x | Foundation indicators already use new pattern; notifier local indicator uses old pattern |
| `MongooseHealthIndicator` built-in | Custom indicator with native driver | N/A | Project uses native MongoDB, not Mongoose. Custom indicator is correct. |

**Deprecated/outdated:**
- `HealthIndicator` base class: Still works in terminus 11.x but `HealthIndicatorService` is the recommended pattern. The notifier's local indicator should be migrated.

## Open Questions

1. **Promise.all vs Promise.allSettled for gateway**
   - What we know: `Promise.all` fails fast on first rejection; `Promise.allSettled` collects all results
   - What's unclear: Whether terminus `health.check()` can handle partial results or expects all-or-nothing
   - Recommendation: Use `Promise.allSettled` to collect all gRPC results, then construct per-indicator thunks that either return the result or throw, feeding them to `health.check()`. This gives full visibility into which services are down.

2. **Whether to remove MemoryHealthIndicator import from gateway**
   - What we know: D-07 says no heap check in liveness. Gateway currently imports `MemoryHealthIndicator`.
   - Recommendation: Remove the import and constructor injection since it is no longer used.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (project constraint: no tests in audit phase) |
| Config file | N/A |
| Quick run command | `pnpm turbo build` (compilation check) |
| Full suite command | `pnpm turbo build` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HLTH-01 | Gateway parallel gRPC checks | manual | `curl http://localhost:3000/health/ready` | N/A (Phase 8 verification) |
| HLTH-02 | Tuned retry defaults + jitter + env vars | manual | Build succeeds: `pnpm turbo build --filter=@email-platform/foundation` | N/A |
| HLTH-03 | Separate liveness/readiness per service | manual | `curl http://localhost:{port}/health/live` and `/health/ready` per service | N/A (Phase 8 verification) |

### Sampling Rate
- **Per task commit:** `pnpm turbo build` (TypeScript compilation)
- **Per wave merge:** `pnpm turbo build` (full monorepo build)
- **Phase gate:** Build green; runtime verification deferred to Phase 8 (VER-01 through VER-04)

### Wave 0 Gaps
None -- no test infrastructure needed for this phase per project constraint ("without tests").

## Sources

### Primary (HIGH confidence)
- Codebase analysis: All 6 health controllers, health modules, 3 foundation indicators, retry-connect.ts, health-constants.ts, env-schema.ts, .env.example
- @nestjs/terminus 11.1.1 (verified via npm registry) -- HealthIndicatorService API

### Secondary (MEDIUM confidence)
- NestJS terminus documentation patterns for HealthIndicatorService usage

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all packages already installed, versions verified
- Architecture: HIGH -- full codebase analysis of all files involved, clear patterns established
- Pitfalls: HIGH -- identified from direct code inspection (naming conflicts, over-injection, API version mismatch)

**Research date:** 2026-04-02
**Valid until:** 2026-05-02 (stable domain, no fast-moving dependencies)
