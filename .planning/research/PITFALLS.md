# Pitfalls Research: Infrastructure Abstractions & Cross-Cutting Concerns

**Domain:** NestJS microservices infrastructure modules (gRPC, RabbitMQ, HTTP, S3, Redis, tracing, shutdown, circuit breaker, config)
**Researched:** 2026-04-08
**Confidence:** HIGH (verified against existing codebase patterns, official docs, community incidents)

## Critical Pitfalls

Mistakes that cause data loss, service outages, or require rewrites.

### Pitfall 1: Shutdown Order Inversion — Processing Stops Before Connections Drain

**What goes wrong:**
New infrastructure modules (RabbitMQ, Redis, S3, HTTP) each implement `OnApplicationShutdown` independently, but NestJS does not guarantee ordering between modules. Result: RabbitMQ consumer acknowledges a message, triggers a DB write, but PostgreSQL pool is already closed. Or: circuit breaker opens during shutdown because health checks fail on already-closed Redis.

**Why it happens:**
The existing `DrizzleShutdownService` works in isolation. When 4-5 new modules each register their own shutdown hooks, the execution order depends on module import order in the root module — which is implicit and fragile. Developers copy the PersistenceModule pattern without considering cross-module shutdown dependencies.

**How to avoid:**
Create a centralized `ShutdownOrchestrator` service in foundation that manages shutdown phases explicitly:
1. Stop accepting new work (close gRPC server, stop RabbitMQ consumers)
2. Wait for in-flight requests to complete (with timeout)
3. Flush outbound (publish pending RabbitMQ messages, flush Redis pipelines)
4. Close client connections (Redis, RabbitMQ, S3, HTTP)
5. Close database pool (last — other modules may need it during flush)

Register it as a single `OnApplicationShutdown` handler. Each infrastructure module registers itself with the orchestrator rather than implementing shutdown independently.

**Warning signs:**
- Multiple `OnApplicationShutdown` implementations across different modules
- Sporadic "connection closed" errors in logs during SIGTERM
- Lost RabbitMQ messages during deployments
- Test: `kill -TERM <pid>` and check if all in-flight operations complete

**Phase to address:**
Graceful Shutdown phase — must come AFTER all client modules are built, so it can orchestrate them all.

---

### Pitfall 2: RabbitMQ Message Loss on Consumer Crash — Missing Dead Letter and Nack Handling

**What goes wrong:**
NestJS default RabbitMQ transport auto-acknowledges messages before the handler completes. If the handler throws or the process crashes mid-processing, the message is lost forever. No dead letter queue exists, so poison messages crash the consumer repeatedly.

**Why it happens:**
NestJS `@MessagePattern` and `@EventPattern` with the built-in RabbitMQ transport use auto-ack by default. The NestJS docs show simple examples without DLQ configuration. Developers assume the framework handles reliability.

**How to avoid:**
- Use manual acknowledgment mode (`noAck: false` in transport options)
- Handler must explicitly `channel.ack(message)` only after successful processing
- Configure dead letter exchange (DLX) and dead letter queue (DLQ) per consumer queue
- Set message TTL on DLQ to prevent infinite accumulation
- Implement idempotent handlers: every consumer must handle duplicate delivery (RabbitMQ delivers at-least-once with manual ack)
- Store processed message IDs (correlation ID or message ID) in Redis/PostgreSQL to deduplicate

**Warning signs:**
- No `noAck: false` in RabbitMQ transport config
- No DLQ/DLX configuration in queue assertions
- Handlers that modify state without idempotency guards
- Missing `channel.nack()` calls in error paths

**Phase to address:**
RabbitMQ/EventModule phase — these patterns must be baked into the abstraction from day one, not bolted on later.

---

### Pitfall 3: gRPC Client Type-Safety Gap — Runtime Mismatch with Compiled Protos

**What goes wrong:**
The existing `GrpcClientModule.register()` returns a `ClientGrpc` that requires manual `.getService<T>()` calls with a generic type parameter. If the proto changes but the TypeScript interface is stale (or the wrong interface is used), calls succeed at compile time but fail at runtime with cryptic gRPC errors like `UNIMPLEMENTED` or silent field dropping.

**Why it happens:**
The current pattern uses `ClientsModule.registerAsync()` which gives a raw `ClientGrpc` proxy. The type safety depends entirely on the developer passing the correct generic — there is no compile-time connection between the proto file specified in options and the TypeScript type used in `.getService<AuthServiceClient>()`. After `pnpm generate:contracts`, the generated types update, but consuming services may not update their imports.

**How to avoid:**
- Create typed client wrappers in `packages/foundation` that enforce proto-to-type binding
- Each gRPC client adapter in `apps/*/src/infrastructure/clients/` wraps `ClientGrpc.getService()` with the correct generated type — never expose raw `ClientGrpc` to application layer
- Add a build-time check: `turbo generate && turbo typecheck` must run in sequence (already in Turbo pipeline)
- Service-specific client adapters implement outbound port interfaces from the application layer — the port defines the contract, the adapter binds it to the correct gRPC service

**Warning signs:**
- Direct `@Inject(DI_TOKEN)` of `ClientGrpc` in use cases or controllers (should only be in infrastructure adapters)
- `.getService<any>()` or untyped service calls
- gRPC `UNIMPLEMENTED` errors after proto changes

**Phase to address:**
gRPC Client abstraction phase — typed wrappers must be the first thing built before other services consume gRPC clients.

---

### Pitfall 4: Monolithic Env Schema Becomes Undecomposable — Every Module Needs Everything

**What goes wrong:**
The current `GlobalEnvSchema` in `packages/config` is a single Zod object with ~30 fields. Adding RabbitMQ, Redis, S3, tracing, and circuit breaker config adds 20+ more fields. Every service validates ALL fields at startup, even ones it does not use (gateway validates `DATABASE_URL` even though it has no database). Result: service A cannot start because service B's env var is missing from `.env`.

**Why it happens:**
The existing pattern calls `loadGlobalConfig()` in every `main.ts`, which validates the entire schema. Adding new infrastructure modules means adding their env vars to `GlobalEnvSchema`. The monolithic schema made sense with 5-6 services sharing the same infra, but with 9 new categories of config, it becomes untenable.

**How to avoid:**
- Decompose `GlobalEnvSchema` into composable schema fragments: `PersistenceEnvSchema`, `RabbitMqEnvSchema`, `RedisEnvSchema`, `S3EnvSchema`, `TracingEnvSchema`
- Each infrastructure module in foundation declares its own schema fragment
- Service `main.ts` composes only the schemas it needs: `z.object({ ...TopologySchema.shape, ...PersistenceEnvSchema.shape, ...RabbitMqEnvSchema.shape })`
- Keep `InfrastructureSchema` as a convenience export that merges all fragments
- CRITICAL: No `.default()` or `.optional()` — the 12-Factor skill is still enforced; every composed schema still requires all its vars

**Warning signs:**
- Services fail to start because of env vars they do not use
- `.env.example` grows past 50 lines with vars irrelevant to most services
- Adding one infrastructure module requires updating `.env` files for all environments
- `docker-compose.yml` environment sections become copy-paste blocks

**Phase to address:**
Config Decomposition phase — should be one of the FIRST phases, because every subsequent infrastructure module needs to add its own env vars without bloating the global schema.

---

### Pitfall 5: Circuit Breaker Applied to Wrong Layer — Breaking Internal Service Communication

**What goes wrong:**
Developers apply circuit breaker to gRPC calls between internal services. When the auth service is slow, the circuit opens and gateway starts rejecting ALL requests — even though the issue might be transient. Circuit breaker is designed for external, unreliable dependencies, not for internal services behind a load balancer.

**Why it happens:**
Circuit breaker is discussed alongside resilience patterns, and developers apply it uniformly. The existing `retryConnect` and `grpc-deadline.interceptor` handle gRPC resilience differently (retry + deadline), but the conceptual boundary is unclear.

**How to avoid:**
- Circuit breaker ONLY for external HTTP calls (AppStoreSpy API, Google Cloud Proxy, Telegram Bot API)
- Internal gRPC communication uses: deadlines (already exists), retries with backoff (already exists), health checks for routing
- Document the boundary explicitly: `CircuitBreakerModule` lives in foundation but is only used by services making external HTTP calls (parser, sender, notifier)
- The HTTP client abstraction should integrate circuit breaker internally — consumers do not configure it separately

**Warning signs:**
- `CircuitBreakerInterceptor` applied to gRPC client calls
- Circuit breaker wrapping `ClientGrpc.getService()` methods
- Gateway returning 503 when a single backend service is degraded

**Phase to address:**
Circuit Breaker phase — must clearly scope to HTTP client only, with documentation explaining why gRPC uses different resilience patterns.

---

### Pitfall 6: S3 Client Assumes AWS — Garage/MinIO Signature and Feature Gaps

**What goes wrong:**
Using `@aws-sdk/client-s3` with default settings against Garage fails. AWS SDK v3 recently added default checksum validation (`requestChecksumCalculation: WHEN_SUPPORTED`) which is incompatible with Garage and most S3-compatible storage. Presigned URLs generated with `@aws-sdk/s3-request-presigner` fail with `SignatureDoesNotMatch` on MinIO/Garage because of host header handling differences.

**Why it happens:**
AWS SDK v3 assumes AWS S3 as the target. S3-compatible storage (Garage, MinIO) implements a subset of the API. Garage specifically lacks: bucket policies, object tagging, versioning, server-side encryption. Code that uses these features silently fails or throws unexpected errors.

**How to avoid:**
- Force path-style access: `forcePathStyle: true` in S3Client config (Garage does not support virtual-hosted-style)
- Disable checksum: `requestChecksumCalculation: 'WHEN_REQUIRED'` and `responseChecksumValidation: 'WHEN_REQUIRED'`
- For presigned URLs: test with Garage in CI, not just local MinIO
- Build the S3 abstraction around the Garage-supported subset only: PutObject, GetObject, DeleteObject, ListObjectsV2, multipart upload, presigned URLs
- Do NOT use: bucket policies, tagging, versioning, encryption, analytics — Garage does not support them
- Env rename: `MINIO_*` to `S3_*` with `STORAGE_*` prefix (already planned in infrastructure schema as `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY`, etc.)

**Warning signs:**
- `SignatureDoesNotMatch` errors from Garage
- Presigned URLs work locally (MinIO) but fail on prod (Garage)
- `checksum` related errors after AWS SDK upgrade
- Code using `PutBucketPolicy` or `PutObjectTagging`

**Phase to address:**
S3/StorageModule phase — the client configuration must be tested against Garage from the start.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Wrapping `amqplib` directly instead of using NestJS transport | Full control over channels | Loses NestJS lifecycle integration, no auto-reconnect, manual serialization | Never — NestJS transport or `@golevelup/nestjs-rabbitmq` handles this |
| Single Redis connection for cache + pub/sub | Fewer connections | Pub/sub blocks the connection — cache operations hang during subscription | Never — use separate connections for cache vs pub/sub |
| Hardcoding circuit breaker thresholds | Quick to implement | Different external APIs have different failure rates; one config does not fit all | Never — make thresholds per-client configurable via env vars |
| Skipping idempotency in RabbitMQ consumers | Simpler handler code | Duplicate processing on redelivery — double sends, double writes | Never — at-least-once delivery requires idempotency |
| Using `setTimeout` for retry delays | No dependencies | Uninterruptible during shutdown, no jitter, no backoff cap | Prototyping only — use `retryConnect` pattern from foundation |
| Global `REDIS_URL` for all services | Fewer env vars | All services share one Redis, key collisions between services | Only if using key prefixes per service (e.g., `auth:session:*`, `sender:cache:*`) |

## Integration Gotchas

Common mistakes when connecting infrastructure modules together.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| RabbitMQ + Tracing | Publishing messages without propagating trace context in headers | Inject trace context (W3C traceparent) into AMQP message headers before publish; extract on consumer side |
| gRPC + Tracing | Relying on NestJS auto-instrumentation to propagate across gRPC | gRPC metadata must carry traceparent; add interceptor that reads/writes metadata — the existing `CorrelationInterceptor` handles correlation ID but NOT OpenTelemetry trace context |
| Circuit Breaker + HTTP Client | Separate circuit breaker interceptor wrapping HTTP client | Circuit breaker should be INSIDE the HTTP client abstraction — the consumer calls `httpClient.get()` and resilience is transparent |
| Redis + Graceful Shutdown | Calling `redis.quit()` before flushing RabbitMQ publishers that cache in Redis | Shutdown orchestrator must flush RabbitMQ (which may read from Redis) before closing Redis |
| S3 + HTTP Client | Routing S3 calls through the generic HTTP client with circuit breaker | S3 client is a separate abstraction — it uses AWS SDK directly, not the HTTP client. Different retry/timeout semantics |
| Config + All Modules | Each module reads env vars directly via `process.env` or raw `ConfigService.get()` | Each module defines a typed config interface; the module's `forRootAsync()` receives validated, typed config — never raw strings |
| PersistenceModule + EventModule | Service imports both but handlers fail because DB transaction spans across RabbitMQ publish | Use outbox pattern or publish AFTER commit — never publish inside a DB transaction |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| One RabbitMQ channel for all operations | High-throughput publishes block consumer acks | Separate channels for publish and consume; channel-per-thread for publishers | >100 msg/sec |
| Redis without key expiry | Memory grows unbounded, OOM kill | Every cached key must have TTL; use `EX` option on every `SET` | Weeks of production data |
| Synchronous presigned URL generation per file | Request latency spikes on bulk operations | Generate presigned URLs in batch; use server-side redirect for downloads | >50 files per request |
| gRPC client without connection pooling | All calls serialize through one HTTP/2 connection | NestJS gRPC client already multiplexes streams over one connection (HTTP/2); pooling is NOT needed for gRPC | Not applicable — HTTP/2 handles this |
| Circuit breaker with global state across services | One external API failure trips circuit for all services | Per-service, per-target circuit breaker instances | >3 external API dependencies |
| OpenTelemetry tracing every operation | CPU and memory overhead from span creation | Sample traces (e.g., 10% in production); always trace errors; use head-based sampling | >1000 req/sec |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| S3 presigned URLs without expiry limit | Files accessible indefinitely via leaked URL | Set `expiresIn` to minimum needed (15 min for uploads, 1 hour for downloads) |
| RabbitMQ credentials in connection URL logged | Credentials in plain text in logs | Use structured logging that redacts URL credentials; never log full `RABBITMQ_URL` |
| Redis keys without service prefix | Service A reads/overwrites service B's data | Enforce key prefix convention: `{service}:{domain}:{id}` — validate at client wrapper level |
| Accepting forged trace headers from external sources | Attacker injects trace context to manipulate tracing or trigger specific code paths | Sanitize or regenerate trace context at gateway boundary; only propagate internally generated contexts |
| S3 bucket with public access | Files exposed to internet | Garage uses per-key permissions, not bucket policies — ensure access keys have minimal permissions |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **RabbitMQ Module:** Often missing reconnection logic — verify consumer re-subscribes after broker restart
- [ ] **RabbitMQ Module:** Often missing dead letter queue — verify poison messages go to DLQ, not infinite retry
- [ ] **Redis Module:** Often missing separate pub/sub connection — verify cache operations work while subscriptions active
- [ ] **S3 Module:** Often missing multipart abort cleanup — verify incomplete uploads are cleaned up (lifecycle policy)
- [ ] **HTTP Client:** Often missing request timeout — verify every outbound HTTP call has explicit timeout (not infinite default)
- [ ] **HTTP Client:** Often missing response body size limit — verify large responses do not OOM the service
- [ ] **Circuit Breaker:** Often missing fallback behavior — verify what happens when circuit opens (return cached? return error? queue for retry?)
- [ ] **Graceful Shutdown:** Often missing in-flight request drain — verify `kill -TERM` waits for active requests to complete
- [ ] **Graceful Shutdown:** Often missing shutdown timeout — verify forced exit after N seconds if drain does not complete
- [ ] **Tracing:** Often missing async context propagation — verify trace IDs survive across `await` boundaries and RabbitMQ handlers
- [ ] **Config Decomposition:** Often missing validation on composition — verify `z.object({ ...A.shape, ...B.shape })` does not silently drop fields with same name
- [ ] **All Modules:** Often missing health indicator — verify each module exports a health check that the service's health controller uses

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Shutdown order inversion (data loss) | HIGH | Add ShutdownOrchestrator, replay lost messages from RabbitMQ DLQ, audit DB for partial writes |
| RabbitMQ message loss (no DLQ) | HIGH | Cannot recover lost messages; add DLQ going forward; if source data exists, replay from source |
| gRPC type mismatch after proto change | LOW | Run `pnpm generate:contracts && pnpm typecheck` — compiler errors show all mismatches |
| Monolithic config blocking service start | LOW | Temporarily add missing env vars; then decompose schema in next sprint |
| Circuit breaker on internal gRPC | MEDIUM | Remove circuit breaker from gRPC clients; add proper deadline/retry config instead |
| S3 signature mismatch with Garage | LOW | Add `forcePathStyle: true` and disable checksums in S3Client config |
| Redis key collision between services | MEDIUM | Audit existing keys; add prefix migration; enforce prefix in client wrapper |
| Tracing context lost across RabbitMQ | LOW | Add header propagation interceptors; existing spans remain valid, just disconnected |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Monolithic env schema | Config Decomposition (first phase) | Each service starts with only its own env vars; gateway starts without DATABASE_URL |
| gRPC type-safety gap | gRPC Client abstraction | Typed client wrappers compile-checked against generated protos; no raw `ClientGrpc` in app layer |
| RabbitMQ message loss | RabbitMQ/EventModule | Manual ack mode verified; DLQ configured; poison message test passes |
| S3 Garage incompatibility | S3/StorageModule | Integration test against Garage (not just MinIO); presigned URL round-trip test |
| Redis key collision | Redis Client | Key prefix enforced in wrapper; two services writing to same Redis verified no collision |
| Circuit breaker misapplication | Circuit Breaker + HTTP Client | Circuit breaker only in HTTP client module; gRPC clients have no circuit breaker |
| Shutdown order inversion | Graceful Shutdown (last infra phase) | `kill -TERM` test: all connections close cleanly, no errors, in-flight requests complete |
| Tracing context loss | Distributed Tracing | End-to-end trace visible: HTTP request -> gRPC call -> RabbitMQ message -> consumer |
| Integration: DB transaction + RabbitMQ publish | RabbitMQ/EventModule | Publish happens AFTER commit; outbox pattern documented |
| Integration: Tracing + existing correlation ID | Distributed Tracing | Correlation ID and OpenTelemetry trace ID coexist; both visible in logs |

## Phase Ordering Implications

Based on pitfall dependencies, the recommended phase order is:

1. **Config Decomposition** — everything else adds env vars; decompose first or it compounds
2. **Redis Client** — simple, few pitfalls, establishes module pattern alongside PersistenceModule
3. **S3/StorageModule** — standalone, validates Garage compatibility early
4. **HTTP Client + Circuit Breaker** — circuit breaker is internal to HTTP client, build together
5. **gRPC Client Abstraction** — typed wrappers over existing `GrpcClientModule`
6. **RabbitMQ/EventModule** — most complex, most pitfalls, benefits from all preceding patterns
7. **Distributed Tracing** — needs all transports (gRPC, RabbitMQ, HTTP) to exist for propagation
8. **Graceful Shutdown Orchestrator** — needs all modules to exist so it can orchestrate them

## Sources

- Existing codebase: `packages/foundation/src/persistence/` (PersistenceModule pattern)
- Existing codebase: `packages/config/src/env-schema.ts` (monolithic schema)
- Existing codebase: `packages/foundation/src/resilience/` (retry, deadline patterns)
- [NestJS RabbitMQ Transport docs](https://docs.nestjs.com/microservices/rabbitmq) — auto-ack behavior
- [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events) — shutdown hook ordering
- [NestJS Circular Dependency docs](https://docs.nestjs.com/fundamentals/circular-dependency) — config decomposition risks
- [Garage S3 Compatibility](https://garagehq.deuxfleurs.fr/documentation/reference-manual/s3-compatibility/) — feature gaps
- [MinIO presigned URL issues](https://github.com/minio/minio/issues/19067) — AWS SDK v3 signature mismatch
- [NestJS graceful shutdown for RabbitMQ](https://medium.com/@pasalino/nestjs-graceful-shutdown-for-rabbitmq-microservices-a98efe809b85) — consumer drain problem
- [ioredis connection pooling issues](https://github.com/redis/ioredis/issues/123) — single connection model
- [opossum circuit breaker](https://github.com/nodeshift/opossum) — Node.js circuit breaker reference
- [OpenTelemetry context propagation](https://opentelemetry.io/docs/concepts/context-propagation/) — W3C traceparent standard
- [NestJS gRPC server shutdown issue](https://github.com/nestjs/nest/issues/12005) — graceful gRPC shutdown gaps

---
*Pitfalls research for: NestJS infrastructure abstractions & cross-cutting concerns (v4.0)*
*Researched: 2026-04-08*
