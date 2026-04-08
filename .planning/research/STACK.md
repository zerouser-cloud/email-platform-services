# Stack Research: Infrastructure Abstractions & Cross-Cutting Concerns

**Domain:** NestJS microservices infrastructure layer (v4.0)
**Researched:** 2026-04-08
**Confidence:** HIGH

## Existing Stack (DO NOT change)

Already validated and in use -- listed here to prevent duplication:

| Technology | Version | Role |
|------------|---------|------|
| NestJS | 11.0.1 | Framework, microservices |
| @nestjs/microservices | 11.0.1 | gRPC transport |
| @grpc/grpc-js | 1.14.3 | gRPC runtime |
| drizzle-orm + pg | 0.45.2 / 8.20.0 | PostgreSQL ORM |
| nestjs-pino + pino | 4.6.0 / 10.3.1 | Structured logging |
| nestjs-cls | 6.2.0 | Correlation ID propagation |
| @nestjs/terminus | 11.1.1 | Health checks |
| Zod | 4.3.6 | Env schema validation |
| class-validator + class-transformer | 0.15.1 / 0.5.1 | DTO validation |

## Recommended Stack Additions

### RabbitMQ Client

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @golevelup/nestjs-rabbitmq | 9.0.0 | Publisher/consumer abstraction | Decorator-based handlers (`@RabbitSubscribe`), automatic exchange/queue setup, connection resiliency via amqp-connection-manager, topic exchange support. Far richer RabbitMQ API than `@nestjs/microservices` which treats all transports generically and loses RabbitMQ-specific features (exchanges, routing keys, dead letter queues). Peer dep `@nestjs/common: ^11.1.17` -- satisfied by `^11.0.1` range resolving to 11.1.18. |

**Why NOT `@nestjs/microservices` RabbitMQ transport:** The built-in transport abstracts away RabbitMQ specifics (no exchange types, no routing keys, no DLQ config, no consumer prefetch). The project needs topic exchanges with routing keys (`sender.campaign.completed`, `parser.batch.ready`) which `@nestjs/microservices` doesn't natively support.

**Why NOT raw amqplib:** Requires manual connection management, reconnection logic, channel pooling. `@golevelup` wraps `amqp-connection-manager` (which wraps amqplib) and adds NestJS DI integration, decorator discovery, and health hooks.

### HTTP Client (External APIs)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @nestjs/axios | 4.0.1 | HTTP client DI module | NestJS-native DI wrapper around axios. Provides `HttpModule.registerAsync()` pattern matching PersistenceModule style. Services inject `HttpService` and get Observable-based API with interceptors. Peer deps: `@nestjs/common ^10.0.0 || ^11.0.0`, `axios ^1.3.1`. |
| axios | 1.9.x | HTTP client engine | Mature, widely used, interceptor chain for auth headers/retry/logging. Already has OTel auto-instrumentation support. |

**Why NOT native `fetch`:** No interceptor chain, no request/response transformation, no timeout configuration, no automatic retries. Would need to build all of that manually.

**Why NOT `undici`:** Latest (8.x) requires Node.js >= 22.19.0. Project uses Node.js 20. Not compatible.

**Why NOT `got`:** ESM-only since v12, complicates TypeScript CJS build. Less NestJS ecosystem integration than axios.

### S3 Client (MinIO / Garage)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @aws-sdk/client-s3 | 3.x (latest ~3.1026) | S3 operations (get, put, delete, list) | Official AWS SDK v3, modular (tree-shakeable), works with any S3-compatible backend (MinIO, Garage) via `endpoint` + `forcePathStyle: true`. Industry standard. |
| @aws-sdk/lib-storage | 3.x (latest ~3.1026) | Multipart uploads | Managed multipart upload for large files (CSV exports from parser, email attachments). Same SDK family. |

**Why NOT minio-js (minio npm):** Proprietary API that only works with MinIO. AWS SDK works with MinIO, Garage, and real S3 -- one client for any backend. The project already uses Garage in prod; using AWS SDK means zero vendor lock-in.

**Config:** Existing env vars (`STORAGE_ENDPOINT`, `STORAGE_PORT`, `STORAGE_ACCESS_KEY`, `STORAGE_SECRET_KEY`, `STORAGE_BUCKET`, `STORAGE_REGION`) map directly to AWS SDK `S3Client` config. No env rename needed -- the v3.0 migration already renamed from MINIO_* to STORAGE_*.

### Redis Client

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ioredis | 5.10.1 | Redis client | De facto standard for Node.js Redis. Supports clusters, sentinels, pipelining, Lua scripting. Node.js >= 12. High performance, battle-tested. |

**Integration pattern:** Custom `RedisModule.forRootAsync()` in foundation following PersistenceModule pattern -- DI token (`REDIS_CLIENT`), health indicator, shutdown service. No need for community wrappers (`@nestjs-modules/ioredis`, `liaoliaots/nestjs-redis`) -- they add indirection without value when you already have a clean module pattern.

**Why NOT `redis` (node-redis):** ioredis has better TypeScript support, more features (cluster mode, sentinel), and higher community adoption in NestJS ecosystem. The `redis` package is catching up but ioredis remains the safer choice.

**Existing env:** `REDIS_URL` already in `InfrastructureSchema`. Maps directly to `new Redis(config.get('REDIS_URL'))`.

### Resilience (Circuit Breaker + Retry + Timeout)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| cockatiel | 3.2.1 | Circuit breaker, retry, timeout, bulkhead, fallback | Unified resilience library inspired by .NET Polly. Composable policies (`circuitBreaker.wrap(retry.wrap(timeout))`). Pure TypeScript, zero dependencies. Node.js >= 16 (v3.x). **DO NOT use v4.0.0** -- requires Node.js >= 22, incompatible with project's Node.js 20 runtime. |

**Why NOT opossum:** Circuit breaker only -- no retry, timeout, bulkhead. Would need separate libraries for each concern. Cockatiel provides all resilience patterns in one composable API.

**Why NOT custom implementation:** The existing `retryConnect` in foundation handles connection retry only. Cockatiel provides a battle-tested circuit breaker state machine (closed/open/half-open) with proper event emission. Writing this correctly is non-trivial.

**Integration:** Wrap external HTTP calls (AppStoreSpy API, Google Cloud Proxy, Telegram Bot API) with cockatiel policies. Per-service adapter creates its own policy instance with service-specific thresholds.

### Distributed Tracing

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @opentelemetry/sdk-node | 0.214.0 | OTel SDK entry point | Official Node.js SDK. Engines: `^18.19.0 || >=20.6.0` -- compatible with Node.js 20. Peer dep: `@opentelemetry/api >=1.3.0 <1.10.0`. |
| @opentelemetry/api | 1.9.x | OTel API (spans, context) | Stable API surface. Required peer dep for all OTel packages. |
| @opentelemetry/exporter-trace-otlp-http | 0.214.0 | Trace export via OTLP/HTTP | Sends traces to Jaeger, Grafana Tempo, or any OTLP collector. HTTP transport simpler than gRPC for the exporter itself. |
| @opentelemetry/instrumentation-nestjs-core | 0.60.0 | NestJS auto-instrumentation | Auto-creates spans for controllers, guards, interceptors, pipes. Peer dep: `@opentelemetry/api ^1.3.0`. |
| @opentelemetry/instrumentation-http | 0.214.0 | HTTP request tracing | Auto-instruments incoming/outgoing HTTP. Captures axios calls automatically. |
| @opentelemetry/instrumentation-grpc | 0.214.0 | gRPC call tracing | Auto-instruments @grpc/grpc-js. Trace propagation through gRPC metadata happens automatically. |

**Why NOT nestjs-otel or Nestjs-OpenTelemetry:** These are thin wrappers around OTel SDK that add NestJS decorators (`@OtelCounter`, `@Span`). Not needed -- the auto-instrumentation packages already create spans for NestJS controllers, HTTP, and gRPC without decorators. Adding wrappers creates version coupling risk with both NestJS and OTel. Use official OTel packages directly.

**Architecture:** OTel SDK initializes in `main.ts` BEFORE NestJS bootstrap (required for auto-instrumentation). A `tracing.ts` file in each service (or shared in foundation) configures the SDK. No NestJS module needed -- OTel hooks into Node.js runtime directly.

**Trace propagation:** gRPC metadata propagation is automatic via `@opentelemetry/instrumentation-grpc`. RabbitMQ header propagation needs manual W3C Trace Context injection/extraction in the EventModule publisher/consumer -- OTel does not auto-instrument amqplib by default without `@opentelemetry/instrumentation-amqplib`.

| @opentelemetry/instrumentation-amqplib | 0.46.0 | RabbitMQ trace propagation | Auto-instruments amqplib (used by @golevelup internally). Propagates trace context through message headers. |

### Graceful Shutdown

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| (built-in NestJS) | -- | Lifecycle hooks | `enableShutdownHooks()` + `OnApplicationShutdown` interface. Already used in `DrizzleShutdownService`. Extend pattern to Redis, RabbitMQ, S3 clients. |
| nestjs-graceful-shutdown | 2.0.0 | HTTP connection draining | Uses `http-terminator` to properly close keep-alive connections. Prevents gateway hanging on deploy. Peer dep: `@nestjs/common *`, `http-terminator ^3.2.0`. Only needed for gateway (HTTP service). gRPC services use `server.tryShutdown()` natively. |
| http-terminator | 3.2.0 | HTTP server termination | Tracks in-flight requests, closes idle keep-alive sockets. Required by nestjs-graceful-shutdown. |

**Pattern:** Each foundation module (PersistenceModule, EventModule, StorageModule, RedisModule) includes its own shutdown service implementing `OnApplicationShutdown`. Order is managed by NestJS module dependency graph. `beforeApplicationShutdown` for stopping new work acceptance, `onApplicationShutdown` for closing connections.

## Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| amqp-connection-manager | 5.x | RabbitMQ connection resilience | Transitive dep of @golevelup/nestjs-rabbitmq. Auto-reconnect, channel management. |
| amqplib | 0.10.x | AMQP 0-9-1 protocol | Transitive dep. Low-level RabbitMQ protocol implementation. |
| http-terminator | 3.2.0 | HTTP graceful shutdown | Gateway only. Close keep-alive connections on shutdown. |

## Installation

```bash
# RabbitMQ
pnpm --filter @email-platform/foundation add @golevelup/nestjs-rabbitmq

# HTTP Client
pnpm --filter @email-platform/foundation add @nestjs/axios axios

# S3
pnpm --filter @email-platform/foundation add @aws-sdk/client-s3 @aws-sdk/lib-storage

# Redis
pnpm --filter @email-platform/foundation add ioredis

# Resilience
pnpm --filter @email-platform/foundation add cockatiel@^3.2.1

# Distributed Tracing
pnpm --filter @email-platform/foundation add @opentelemetry/sdk-node @opentelemetry/api @opentelemetry/exporter-trace-otlp-http @opentelemetry/instrumentation-nestjs-core @opentelemetry/instrumentation-http @opentelemetry/instrumentation-grpc @opentelemetry/instrumentation-amqplib

# Graceful Shutdown (gateway only)
pnpm --filter @email-platform/gateway add nestjs-graceful-shutdown http-terminator

# Types
pnpm --filter @email-platform/foundation add -D @types/amqplib
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| @golevelup/nestjs-rabbitmq | @nestjs/microservices RabbitMQ | Only if you need transport-agnostic code (swap RabbitMQ for Kafka without code changes). Not the case here -- RabbitMQ is a committed choice. |
| @nestjs/axios + axios | Native fetch | Simple one-off requests without interceptors, retries, or logging. Not applicable for this project's external API calls. |
| @aws-sdk/client-s3 | minio (npm) | If ONLY using MinIO and never plan to switch backends. Not recommended -- Garage is already used in prod. |
| ioredis | redis (node-redis) | If using Redis modules (JSON, Graph, TimeSeries) -- node-redis has better module support. Not needed here. |
| cockatiel 3.2.1 | opossum | If you only need circuit breaker without retry/timeout/bulkhead composition. Not sufficient for this project. |
| cockatiel 3.2.1 | cockatiel 4.0.0 | When project upgrades to Node.js 22+. Pin to 3.2.1 until then. |
| OTel SDK direct | nestjs-otel wrapper | If you want decorator-based span creation (`@Span()`). Auto-instrumentation covers 90% of needs without decorators. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| cockatiel 4.0.0 | Requires Node.js >= 22. Project uses Node.js 20. | cockatiel 3.2.1 (Node.js >= 16) |
| undici 8.x | Requires Node.js >= 22.19.0. Incompatible. | axios via @nestjs/axios |
| minio (npm package) | Vendor-specific API. Won't work if backend changes from MinIO to Garage/S3. | @aws-sdk/client-s3 with `forcePathStyle: true` |
| nestjs-s3 (npm) | Thin wrapper around AWS SDK v3 that adds no value over direct usage. Unmaintained (1 contributor). | @aws-sdk/client-s3 directly in StorageModule |
| @nestjs-modules/ioredis | Unnecessary abstraction when you already have PersistenceModule pattern to follow. Adds version coupling. | ioredis directly in RedisModule |
| Jaeger client (jaeger-client npm) | Deprecated. Jaeger now uses OpenTelemetry SDK natively. | @opentelemetry/sdk-node + OTLP exporter |

## Integration with Existing Foundation Pattern

Each new module follows the PersistenceModule blueprint:

```
foundation/src/{module}/
  {module}.module.ts       -- DynamicModule with forRootAsync()
  {module}.constants.ts    -- Symbol DI tokens, defaults
  {module}.interfaces.ts   -- Health indicator interface
  {module}.providers.ts    -- Provider factories (inject ConfigService)
  {module}-shutdown.service.ts  -- OnApplicationShutdown
  {module}.health.ts       -- HealthIndicatorService-based check
  index.ts                 -- Barrel exports
```

| New Module | DI Tokens | Health Indicator | Shutdown Service |
|------------|-----------|------------------|------------------|
| EventModule | `RABBITMQ_CONNECTION`, `EVENT_HEALTH` | AmqpConnection.isConnected() check | Close AMQP connection |
| StorageModule | `S3_CLIENT`, `STORAGE_HEALTH` | HeadBucket call on configured bucket | Destroy S3Client |
| RedisModule | `REDIS_CLIENT`, `REDIS_HEALTH` | Redis PING command | client.quit() |
| HttpClientModule | `HTTP_SERVICE`, (no health) | N/A (external APIs) | N/A |
| ResilienceModule | N/A (factory functions) | N/A | N/A |

## Config Decomposition

Current `GlobalEnvSchema` is monolithic. New modules need env vars:

| Module | New Env Vars | Schema Location |
|--------|-------------|-----------------|
| EventModule | `RABBITMQ_URL` (already exists), `RABBITMQ_PREFETCH` | `packages/config/src/messaging.ts` |
| StorageModule | `STORAGE_*` (already exist) | Already in `infrastructure.ts` |
| RedisModule | `REDIS_URL` (already exists) | Already in `infrastructure.ts` |
| Tracing | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | `packages/config/src/tracing.ts` |
| Resilience | `CIRCUIT_BREAKER_THRESHOLD`, `CIRCUIT_BREAKER_DURATION_MS` | `packages/config/src/resilience.ts` |
| Graceful Shutdown | `SHUTDOWN_TIMEOUT_MS` | `packages/config/src/resilience.ts` |

Pattern: Split monolithic `GlobalEnvSchema` into domain-specific schemas (`TopologySchema`, `InfrastructureSchema`, `MessagingSchema`, `TracingSchema`, `ResilienceSchema`) composed via spread: `z.object({ ...TopologySchema.shape, ...InfrastructureSchema.shape, ... })`. This already works -- `TopologySchema` and `InfrastructureSchema` are composed this way today.

## Version Compatibility Matrix

| Package | Requires Node.js | Requires NestJS | Compatible |
|---------|-------------------|-----------------|------------|
| @golevelup/nestjs-rabbitmq 9.0.0 | (not specified) | ^11.1.17 | YES (pnpm resolves ^11.0.1 to 11.1.18) |
| cockatiel 3.2.1 | >= 16 | N/A | YES |
| cockatiel 4.0.0 | >= 22 | N/A | NO -- Node 20 |
| ioredis 5.10.1 | >= 12 | N/A | YES |
| @aws-sdk/client-s3 3.x | >= 16 | N/A | YES |
| @nestjs/axios 4.0.1 | (via NestJS) | ^10 or ^11 | YES |
| @opentelemetry/sdk-node 0.214.0 | ^18.19.0 or >= 20.6.0 | N/A | YES |
| nestjs-graceful-shutdown 2.0.0 | (not specified) | * (any) | YES |
| undici 8.x | >= 22.19.0 | N/A | NO -- Node 20 |

## Sources

- [npm registry](https://www.npmjs.com/) -- version, peerDependencies, engines verified via `npm view` (HIGH confidence)
- [@golevelup/nestjs-rabbitmq npm](https://www.npmjs.com/package/@golevelup/nestjs-rabbitmq) -- v9.0.0 peer deps confirmed
- [cockatiel GitHub](https://github.com/connor4312/cockatiel) -- v3.x Node >= 16, v4.x Node >= 22
- [NestJS RabbitMQ docs](https://docs.nestjs.com/microservices/rabbitmq) -- built-in transport limitations
- [Golevelup RabbitMQ docs](https://golevelup.github.io/nestjs/modules/rabbitmq.html) -- exchange/routing key support
- [OpenTelemetry NestJS guide (SigNoz)](https://signoz.io/blog/opentelemetry-nestjs/) -- production setup patterns
- [@opentelemetry/instrumentation-nestjs-core npm](https://www.npmjs.com/package/@opentelemetry/instrumentation-nestjs-core) -- auto-instrumentation scope
- [NestJS lifecycle events docs](https://docs.nestjs.com/fundamentals/lifecycle-events) -- shutdown hook sequence
- [nestjs-graceful-shutdown npm](https://www.npmjs.com/package/nestjs-graceful-shutdown) -- HTTP termination
- [AWS SDK S3 + MinIO guide](https://northflank.com/guides/connect-nodejs-to-minio-with-tls-using-aws-s3) -- forcePathStyle config

---
*Stack research for: Email Platform v4.0 Infrastructure Abstractions*
*Researched: 2026-04-08*
