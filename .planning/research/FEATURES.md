# Feature Research

**Domain:** NestJS Microservices Infrastructure Abstractions
**Researched:** 2026-04-08
**Confidence:** HIGH

## Feature Landscape

Features are organized by module type. Each module follows the established PersistenceModule pattern: foundation provides the DynamicModule facade (connection, health indicator, DI tokens, shutdown), services consume via `imports: [XModule.forRootAsync()]`.

### Table Stakes (Users Expect These)

Core infrastructure modules that services already reference as stubs or TODOs in the codebase.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **RabbitMQ EventModule** -- connection, publisher, consumer, health indicator | Notifier has stub `RabbitMQEventSubscriber`, sender/parser/audience need publish. Listed in PROJECT.md module architecture table. | HIGH | Biggest module. Needs exchange/queue topology, message serialization, consumer acknowledgment, dead-letter handling. Connection resiliency via `amqp-connection-manager`. |
| **Redis CacheModule** -- client, health indicator, shutdown | `RedisHealthIndicator` is already a stub returning HEALTH.STUB_MESSAGE. Services reference it (sender imports it). REDIS_URL already in env schema. | LOW | Thin wrapper: ioredis client injected via DI token, real health check (PING), shutdown (`client.quit()`). No caching abstraction yet -- just raw client. |
| **S3 StorageModule** -- client, health indicator, shutdown | Env vars already defined (STORAGE_ENDPOINT, STORAGE_ACCESS_KEY, etc.). Parser and notifier need file storage. Garage is S3-compatible. | MEDIUM | AWS SDK v3 `@aws-sdk/client-s3` with `forcePathStyle: true` for Garage/MinIO. Health = HeadBucket. No wrapper libs needed -- SDK v3 is modular enough. |
| **HTTP Client Module** -- configured Axios/fetch wrapper with logging | Parser calls AppStoreSpy API, sender calls Google Cloud proxy, notifier calls Telegram Bot API. Three services need external HTTP. | MEDIUM | NestJS `HttpModule` (`@nestjs/axios`) with per-service configuration (base URL, timeout, headers). Interceptors for logging, correlation ID propagation, error normalization. |
| **Graceful Shutdown Orchestration** -- ordered resource cleanup | `DrizzleShutdownService` exists for PG pool only. Sender/notifier modules have TODO comments for shutdown. Adding more connections (Redis, RabbitMQ, S3) makes ordered shutdown critical. | MEDIUM | Central `ShutdownOrchestrator` service using NestJS lifecycle hooks (`beforeApplicationShutdown`, `onApplicationShutdown`). Order: stop accepting work, drain in-flight, close connections (RabbitMQ consumers first, then publishers, then caches, then DB). |
| **gRPC Client Abstraction** -- type-safe, per-service wrappers | `GrpcClientModule.register()` exists but gateway's `GrpcClientsModule` is empty stub. Services need typed client adapters in `infrastructure/clients/`. | MEDIUM | Foundation already has the module. Missing: per-service typed client wrappers that implement outbound ports. Gateway needs all 4 gRPC clients (auth, sender, parser, audience). Sender needs audience client. |
| **Config Decomposition** -- modular env schemas per concern | Single monolithic `GlobalEnvSchema` mixes topology, infrastructure, logging, CORS, rate limiting. Adding S3, Redis, RabbitMQ config will bloat it further. | LOW | Split into composable schemas: `TopologySchema` (already exists), `InfrastructureSchema` (already exists but flat), `LoggingSchema`, `ResilienceSchema`. Each module validates its own slice. |

### Differentiators (Competitive Advantage)

Features that elevate the platform from "working" to "production-grade observable system."

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Distributed Tracing** -- correlation propagation across gRPC and RabbitMQ | Correlation IDs exist (via `nestjs-cls`) but only within single service. Cross-service tracing is absent. Debugging multi-service flows (gateway -> sender -> audience) requires end-to-end trace. | HIGH | Two approaches: (1) Lightweight -- propagate existing correlationId via gRPC metadata and RabbitMQ message headers. (2) Full OpenTelemetry -- auto-instrumentation with Jaeger/Tempo backend. Recommend approach 1 first (aligns with existing Pino+CLS), defer OTel to later. |
| **Circuit Breaker** -- for external HTTP calls | Parser (AppStoreSpy), sender (Google Cloud proxy), notifier (Telegram) all call external APIs that can go down. Without circuit breaker, cascading failures propagate. | MEDIUM | Use `opossum` library (~100K weekly downloads, battle-tested). Wrap HTTP client calls. States: closed/open/half-open. Configurable thresholds via env vars. Integrate with health checks (circuit open = degraded). |
| **Dead Letter Queue handling** -- for RabbitMQ consumers | Failed message processing without DLQ means silent data loss. Critical for notifier (missed notifications) and audience (failed imports). | MEDIUM | Part of EventModule but deserves separate mention. DLQ exchange + queue per consumer. Configurable retry count before dead-lettering. Monitoring/alerting on DLQ depth. |
| **Health check aggregation pattern** -- unified per-module health | Current health checks are per-indicator. Each new module adds another health indicator to wire manually. | LOW | Each module exports its own health indicator via DI token (like `DATABASE_HEALTH`). Service health controllers compose them. Pattern already established -- just needs consistency across new modules. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full OpenTelemetry from day one** | "Industry standard," auto-instrumentation | Requires Jaeger/Tempo infrastructure, SDK initialization complexity (must load before NestJS), heavy dependency tree, overkill for 6 services on single server | Lightweight correlation ID propagation via gRPC metadata + RabbitMQ headers. Structured Pino logs with correlationId are already queryable. Add OTel when scaling beyond single server. |
| **Caching abstraction layer over Redis** | "Services shouldn't know about Redis" | Premature abstraction. No caching use cases implemented yet. Abstract interface without real consumers becomes dead code that drifts from reality. | Expose raw ioredis client via DI token. When caching use cases emerge in business logic phase, add thin domain-specific cache ports then. |
| **Custom RabbitMQ wrapper library** | "golevelup is too opinionated" / "native transport is too generic" | Building custom AMQP wrapper is months of work (connection recovery, channel management, message serialization, error handling). Both existing options are battle-tested. | Use `@golevelup/nestjs-rabbitmq` -- it provides exchange/queue management, Pub/Sub decorators, RPC, connection resiliency via amqp-connection-manager. 131K weekly downloads, active maintenance. Native NestJS transport is too generic for topic exchanges. |
| **Universal retry/resilience decorator** | "One decorator for all external calls" | Different externals need different strategies: gRPC needs reconnect retry (already exists), HTTP needs circuit breaker, RabbitMQ needs consumer retry with backoff. Unified abstraction hides critical differences. | Per-transport resilience: `retryConnect` for connections (exists), `opossum` circuit breaker for HTTP, RabbitMQ's native retry+DLQ for messaging. |
| **Abstract storage interface hiding S3** | "What if we switch from S3 to GCS?" | Garage and MinIO are both S3-compatible. GCS also has S3 compatibility mode. S3 API is the universal standard. Abstracting it adds a layer with zero practical benefit. | Use `@aws-sdk/client-s3` directly. It works with any S3-compatible storage (AWS, MinIO, Garage, GCS in compat mode). Wrap in a thin StorageModule for DI/health/shutdown -- not for API abstraction. |
| **Service mesh / sidecar pattern** | "Istio handles retries and circuit breaking" | 6 services on a single Coolify server. Docker Compose, not Kubernetes. Service mesh adds operational complexity that exceeds the benefit at this scale. | Application-level resilience (circuit breaker, retry, health checks). Revisit when migrating to Kubernetes. |

## Feature Dependencies

```
[Config Decomposition]
    (no deps, can be done first -- all other modules benefit from modular config)

[Redis CacheModule]
    (no deps beyond config)

[S3 StorageModule]
    (no deps beyond config)

[gRPC Client Abstraction]
    |--depends on--> existing GrpcClientModule + service catalog
    |--depends on--> Config Decomposition (for per-client env vars)

[HTTP Client Module]
    |--depends on--> Config Decomposition (for per-service external API config)

[RabbitMQ EventModule]
    |--depends on--> Config Decomposition (for exchange/queue topology config)

[Circuit Breaker]
    |--depends on--> HTTP Client Module (wraps HTTP calls)

[Distributed Tracing]
    |--depends on--> gRPC Client Abstraction (metadata propagation)
    |--depends on--> RabbitMQ EventModule (header propagation)
    |--depends on--> HTTP Client Module (header propagation)
    |--enhances--> Logging (correlationId already in Pino context)

[Graceful Shutdown Orchestration]
    |--depends on--> all connection-owning modules (PG, Redis, RabbitMQ, S3)
    |--should be built incrementally as modules are added
```

### Dependency Notes

- **Config Decomposition** has zero dependencies and unblocks cleaner config for all modules. Do first.
- **Redis and S3** are independent leaf modules. Can be built in parallel.
- **gRPC Client Abstraction** extends existing `GrpcClientModule` with typed wrappers. Mostly per-service work.
- **RabbitMQ EventModule** is the most complex module. Needs its own exchange/queue topology config.
- **Circuit Breaker depends on HTTP Client** because it wraps external HTTP calls specifically.
- **Distributed Tracing depends on all client modules** because it needs to inject correlation context into each transport. Build last among clients.
- **Graceful Shutdown** should be built incrementally -- each module adds its own shutdown hook following `DrizzleShutdownService` pattern.

## MVP Definition

### Launch With (v1 -- Infrastructure Foundation)

Minimum modules needed for services to have real (non-stub) infrastructure connections.

- [ ] Config Decomposition -- unblocks clean env schemas for all new modules
- [ ] Redis CacheModule -- simplest module, replaces stub health indicator, needed by sender
- [ ] S3 StorageModule -- parser and notifier need file storage, env vars already defined
- [ ] gRPC Client typed wrappers -- gateway is non-functional without them, sender needs audience client
- [ ] Graceful Shutdown basics -- extend existing `DrizzleShutdownService` pattern to all connections

### Add After Validation (v1.x -- Messaging & External APIs)

Features that enable async communication and external integrations.

- [ ] RabbitMQ EventModule -- when implementing business logic that publishes/consumes events
- [ ] HTTP Client Module -- when implementing parser (AppStoreSpy), sender (proxy), notifier (Telegram)
- [ ] Circuit Breaker -- after HTTP clients exist and external APIs are being called

### Future Consideration (v2+)

- [ ] Distributed Tracing (full) -- after all transports work, when debugging multi-service flows becomes painful
- [ ] Dead Letter Queue monitoring -- after RabbitMQ consumers process real messages
- [ ] OpenTelemetry migration -- when scaling beyond single server or needing Jaeger/Tempo dashboards

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Config Decomposition | MEDIUM | LOW | P1 |
| Redis CacheModule | HIGH | LOW | P1 |
| S3 StorageModule | HIGH | MEDIUM | P1 |
| gRPC Client typed wrappers | HIGH | MEDIUM | P1 |
| Graceful Shutdown Orchestration | HIGH | MEDIUM | P1 |
| RabbitMQ EventModule | HIGH | HIGH | P2 |
| HTTP Client Module | HIGH | MEDIUM | P2 |
| Circuit Breaker | MEDIUM | MEDIUM | P2 |
| Distributed Tracing (lightweight) | MEDIUM | HIGH | P3 |
| Dead Letter Queue handling | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Infrastructure foundation -- services need real connections to proceed to business logic
- P2: Communication layer -- enables async flows and external integrations
- P3: Observability & resilience -- production hardening after core works

## Module Pattern Reference

Every new module follows the established PersistenceModule contract:

| Concern | PersistenceModule (reference) | New modules must provide |
|---------|-------------------------------|--------------------------|
| **DI Tokens** | `DRIZZLE`, `PG_POOL`, `DATABASE_HEALTH` (Symbols) | Equivalent Symbol tokens per module |
| **Factory method** | `PersistenceModule.forRootAsync()` | `XModule.forRootAsync()` returning `DynamicModule` |
| **Connection** | `Pool` from `pg` via ConfigService | Client instance from SDK via ConfigService |
| **Health indicator** | `PostgresHealthIndicator` doing `SELECT 1` | Real health check (PING for Redis, HeadBucket for S3, channel check for RabbitMQ) |
| **Shutdown** | `DrizzleShutdownService` implements `OnApplicationShutdown` | Shutdown service closing connections |
| **Constants** | `persistence.constants.ts` with defaults | `x.constants.ts` with named defaults |
| **Exports** | `[TerminusModule, DRIZZLE, PG_POOL, DATABASE_HEALTH]` | All tokens + TerminusModule |

## Per-Module Feature Details

### RabbitMQ EventModule

| Sub-feature | Table Stake? | Notes |
|-------------|-------------|-------|
| Connection management (amqp-connection-manager) | YES | Auto-reconnect, channel pooling |
| Publisher with typed events | YES | `eventModule.publish(exchange, routingKey, payload)` |
| Consumer with `@Subscribe()` decorator | YES | Per-handler queue binding, ack/nack |
| Exchange/queue topology declaration | YES | Assert exchanges and queues on module init |
| Message serialization (JSON) | YES | Consistent envelope: `{ type, payload, metadata: { correlationId, timestamp } }` |
| Dead Letter Queue | DIFFERENTIATOR | Per-consumer DLQ with configurable retry |
| Consumer prefetch/concurrency | DIFFERENTIATOR | Control parallel message processing |

### HTTP Client Module

| Sub-feature | Table Stake? | Notes |
|-------------|-------------|-------|
| Per-service base URL + timeout config | YES | Parser, sender, notifier each get own config |
| Request/response logging | YES | Method, URL, status, duration via Pino |
| Correlation ID in outbound headers | YES | Propagate from CLS context |
| Error normalization | YES | Convert Axios errors to domain-friendly format |
| Circuit breaker integration | DIFFERENTIATOR | Opossum wrapping per-client |
| Retry with backoff for transient errors | DIFFERENTIATOR | 5xx and network errors only |

### S3 StorageModule

| Sub-feature | Table Stake? | Notes |
|-------------|-------------|-------|
| S3Client with forcePathStyle | YES | Required for Garage/MinIO |
| Upload (PutObject) | YES | Stream-based for large files |
| Download (GetObject) | YES | Stream response |
| Delete (DeleteObject) | YES | Cleanup |
| Health check (HeadBucket) | YES | Verify bucket accessible |
| Presigned URLs | DIFFERENTIATOR | For direct browser upload/download |

### Redis CacheModule

| Sub-feature | Table Stake? | Notes |
|-------------|-------------|-------|
| ioredis client via DI token | YES | Single connection, configurable from REDIS_URL |
| PING health check | YES | Replace stub |
| Graceful disconnect | YES | `client.quit()` on shutdown |
| Key prefix per service | DIFFERENTIATOR | Namespace isolation in shared Redis |

## Sources

- [NestJS RabbitMQ Microservices Documentation](https://docs.nestjs.com/microservices/rabbitmq)
- [@golevelup/nestjs-rabbitmq on npm](https://www.npmjs.com/package/@golevelup/nestjs-rabbitmq) -- 131K weekly downloads, connection resiliency, Pub/Sub + RPC
- [NestJS Lifecycle Events (Graceful Shutdown)](https://docs.nestjs.com/fundamentals/lifecycle-events)
- [nestjs-graceful-shutdown on npm](https://www.npmjs.com/package/nestjs-graceful-shutdown)
- [NestJS Graceful Shutdown for RabbitMQ Microservices](https://medium.com/@pasalino/nestjs-graceful-shutdown-for-rabbitmq-microservices-a98efe809b85)
- [Circuit Breaker Pattern with NestJS and Opossum](https://snippets.ltd/blog/circuit-breaker-with-opossum-in-nestjs)
- [OpenTelemetry NestJS Implementation Guide (SigNoz, 2026)](https://signoz.io/blog/opentelemetry-nestjs/)
- [Distributed Tracing for NestJS Microservices with OpenTelemetry](https://medium.com/@qaribhaider/distributed-tracing-for-nestjs-microservices-with-opentelemetry-and-jaeger-540692c51a55)
- [AWS SDK v3 S3 with MinIO compatibility](https://northflank.com/guides/connect-nodejs-to-minio-with-tls-using-aws-s3)
- Existing codebase: `packages/foundation/src/persistence/` (PersistenceModule reference implementation)

---
*Feature research for: NestJS Microservices Infrastructure Abstractions*
*Researched: 2026-04-08*
