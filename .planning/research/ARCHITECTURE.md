# Architecture Research

**Domain:** NestJS microservices infrastructure abstractions (Clean/Hexagonal)
**Researched:** 2026-04-08
**Confidence:** HIGH

## System Overview

### Current State

```
packages/config/          packages/foundation/           packages/contracts/
  env-schema.ts             persistence/                   proto/
  infrastructure.ts           PersistenceModule              *.proto
  topology.ts                 (Pool, Drizzle, Health)       generated/
  catalog/services.ts       grpc/                            *.ts
  config-loader.ts            GrpcClientModule
                              grpc-server.factory
                            logging/
                              LoggingModule
                            errors/
                            health/
                              redis.health (STUB)
                              rabbitmq.health (STUB)
                            resilience/
                              retry-connect
                              grpc-deadline.interceptor
```

```
apps/{service}/src/
  domain/                    # Pure business logic, zero deps
    entities/
  application/               # Ports + use cases
    ports/inbound/           # Service API contracts
    ports/outbound/          # Infrastructure contracts (interfaces)
    use-cases/
  infrastructure/            # Framework integrations
    grpc/                    # gRPC server adapter
    persistence/             # PostgreSQL repository adapters
      schema/                # Drizzle pgSchema
      *.mapper.ts            # toDomain/toPersistence
      pg-*.repository.ts     # Implements outbound port
    clients/                 # (gateway only) gRPC client proxies
    external/                # (notifier) Telegram adapter
    messaging/               # (notifier) RabbitMQ subscriber
  health/
  {service}.module.ts
  {service}.constants.ts
  main.ts
```

### Target State After v4.0

```
packages/foundation/src/
  persistence/               # EXISTS - PostgreSQL (unchanged)
    PersistenceModule        # forRootAsync()
  cache/                     # NEW
    CacheModule              # forRootAsync() - Redis client, health, DI tokens
  event/                     # NEW
    EventModule              # forPublisher() / forConsumer()
    rabbitmq.connection.ts
    rabbitmq.health.ts       # replaces stub in health/indicators/
  storage/                   # NEW
    StorageModule            # forRootAsync() with S3 config
    s3.health.ts
  http-client/               # NEW
    HttpClientModule         # forRootAsync() with circuit breaker
    circuit-breaker.ts
  tracing/                   # NEW
    TracingModule            # correlation propagation helpers
    grpc-tracing.interceptor
    amqp-tracing.interceptor
  shutdown/                  # NEW
    GracefulShutdownModule   # coordinated drain
  grpc/                      # EXISTS - enhance
  logging/                   # EXISTS - unchanged
  errors/                    # EXISTS - unchanged
  health/                    # EXISTS - refactor (move indicators into modules)
  resilience/                # EXISTS - add circuit breaker
```

```
apps/{service}/src/infrastructure/
  persistence/               # EXISTS - unchanged
  grpc/                      # EXISTS - unchanged
  clients/                   # NEW per service: gRPC client adapters
  messaging/                 # NEW per service: RabbitMQ pub/sub adapters
  external/                  # NEW per service: HTTP client adapters
  storage/                   # NEW per service: S3 bucket adapters
```

### Component Responsibilities

| Component | Responsibility | Current | Target |
|-----------|----------------|---------|--------|
| PersistenceModule | PostgreSQL pool, Drizzle ORM, health | READY | Unchanged |
| CacheModule | Redis client, connection, health | STUB | New module |
| EventModule | RabbitMQ connection, channels, health | STUB | New module |
| StorageModule | S3/Garage client, health | NONE | New module |
| HttpClientModule | Axios/fetch wrapper, circuit breaker | NONE | New module |
| TracingModule | Correlation ID propagation across transports | PARTIAL (logging) | Expand |
| GracefulShutdownModule | Coordinated connection drain | TODO comments | New module |
| GrpcClientModule | gRPC client registration with deadline | READY | Minor enhance |
| LoggingModule | Pino + CLS correlation | READY | Unchanged |

## Recommended Project Structure

### Foundation Package (new + modified modules)

```
packages/foundation/src/
  cache/                          # NEW
    cache.module.ts               # CacheModule.forRootAsync()
    cache.constants.ts            # REDIS_CLIENT, CACHE_HEALTH symbols
    cache.interfaces.ts           # CacheClient interface
    cache.providers.ts            # Redis client factory, health provider
    redis.health.ts               # Real health check (replaces stub)
    redis-shutdown.service.ts     # OnApplicationShutdown for Redis
    index.ts
  event/                          # NEW
    event.module.ts               # EventModule.forPublisher() / .forConsumer()
    event.constants.ts            # AMQP_CONNECTION, EVENT_PUBLISHER symbols
    event.interfaces.ts           # EventPublisher, EventConsumer interfaces
    event.providers.ts            # amqplib connection factory
    rabbitmq.health.ts            # Real health check (replaces stub)
    amqp-shutdown.service.ts      # OnApplicationShutdown for AMQP
    index.ts
  storage/                        # NEW
    storage.module.ts             # StorageModule.forRootAsync()
    storage.constants.ts          # S3_CLIENT, STORAGE_HEALTH symbols
    storage.interfaces.ts         # StorageClient interface
    storage.providers.ts          # AWS SDK S3Client factory
    s3.health.ts                  # HeadBucket health check
    index.ts
  http-client/                    # NEW
    http-client.module.ts         # HttpClientModule.forRootAsync()
    http-client.constants.ts      # HTTP_CLIENT symbol
    http-client.interfaces.ts     # HttpClient interface (port-style)
    http-client.providers.ts      # Axios instance factory
    circuit-breaker.ts            # State machine: closed/open/half-open
    circuit-breaker.constants.ts  # Thresholds, timeouts
    index.ts
  shutdown/                       # NEW
    graceful-shutdown.module.ts   # GracefulShutdownModule
    shutdown.service.ts           # OnApplicationShutdown orchestrator
    shutdown.constants.ts         # DRAIN_TIMEOUT, SHUTDOWN_ORDER
    index.ts
  tracing/                        # NEW (extracted from logging)
    tracing.module.ts             # TracingModule
    grpc-tracing.interceptor.ts   # Propagate correlationId via gRPC metadata
    amqp-tracing.interceptor.ts   # Propagate correlationId via AMQP headers
    tracing.constants.ts
    index.ts
```

### Per-Service Infrastructure Additions (example: sender)

```
apps/sender/src/
  application/ports/outbound/
    event-publisher.port.ts        # NEW: interface for publishing domain events
    email-sender.port.ts           # NEW: interface for external HTTP calls
    audience-client.port.ts        # NEW: interface for gRPC calls to audience
  infrastructure/
    messaging/                     # NEW
      rabbitmq-campaign-event.publisher.ts  # Implements event-publisher port
    external/                      # NEW
      google-cloud-email.sender.ts # Implements email-sender port, uses HttpClientModule
    clients/                       # NEW
      audience-grpc.client.ts      # Adapter wrapping GrpcClientModule, implements audience-client port
```

### Structure Rationale

- **Each foundation module follows PersistenceModule pattern:** DynamicModule with `forRootAsync()`, Symbol-based DI tokens, provider array in separate file, health indicator co-located, shutdown service co-located. This is not a guess -- it is the proven pattern from `packages/foundation/src/persistence/`.
- **Per-service adapters stay in `infrastructure/`:** Foundation provides the raw client via DI token. Service wraps it in a typed adapter implementing an outbound port. Domain and application layers never see foundation types directly.
- **Health indicators move INTO their modules:** Currently Redis and RabbitMQ health stubs live in `health/indicators/`. Real implementations belong inside `cache/` and `event/` respectively, co-located with the connection they monitor. The `health/` folder retains only `health-constants.ts`.

## Architectural Patterns

### Pattern 1: Infrastructure Facade Module (reference: PersistenceModule)

**What:** A NestJS DynamicModule in foundation that owns a backing service connection, exposes it via Symbol DI tokens, includes a health indicator, and handles shutdown.

**When to use:** Every backing service (PostgreSQL, Redis, RabbitMQ, S3).

**Trade-offs:** Slightly more boilerplate per module, but perfect isolation. Services import only what they need. Health checks are automatic when the module is imported.

**Example (CacheModule following PersistenceModule pattern):**
```typescript
// cache.constants.ts
export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const CACHE_HEALTH = Symbol('CACHE_HEALTH');

export const REDIS_DEFAULTS = {
  CONNECT_TIMEOUT_MS: 5_000,
  COMMAND_TIMEOUT_MS: 3_000,
} as const;

export const REDIS_HEALTH = {
  PING_COMMAND: 'PING',
  DOWN_MESSAGE: 'Redis connection failed',
} as const;

// cache.module.ts
@Module({})
export class CacheModule {
  static forRootAsync(): DynamicModule {
    return {
      module: CacheModule,
      imports: [TerminusModule],
      providers: [...cacheProviders],
      exports: [TerminusModule, REDIS_CLIENT, CACHE_HEALTH],
    };
  }
}

// cache.providers.ts
const redisClientProvider: Provider = {
  provide: REDIS_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Redis =>
    new Redis(config.get<string>('REDIS_URL'), {
      connectTimeout: REDIS_DEFAULTS.CONNECT_TIMEOUT_MS,
      commandTimeout: REDIS_DEFAULTS.COMMAND_TIMEOUT_MS,
    }),
};

const cacheHealthProvider: Provider = {
  provide: CACHE_HEALTH,
  useExisting: RedisHealthIndicator,
};

export const cacheProviders: Provider[] = [
  redisClientProvider,
  RedisShutdownService,
  RedisHealthIndicator,
  cacheHealthProvider,
];
```

### Pattern 2: Outbound Port + Infrastructure Adapter

**What:** Application layer defines an interface (outbound port). Infrastructure layer implements it with a concrete adapter that uses the DI-injected client from foundation.

**When to use:** Every time a use case needs an external resource (database, message queue, HTTP API, storage).

**Trade-offs:** More files, but domain/application code never depends on infrastructure. Adapters are swappable.

**Example (sender publishing events):**
```typescript
// application/ports/outbound/event-publisher.port.ts
export interface CampaignEventPublisher {
  campaignCompleted(campaignId: string): Promise<void>;
  emailFailed(campaignId: string, recipientId: string, reason: string): Promise<void>;
}

// infrastructure/messaging/rabbitmq-campaign-event.publisher.ts
@Injectable()
export class RabbitMqCampaignEventPublisher implements CampaignEventPublisher {
  constructor(@Inject(EVENT_PUBLISHER) private readonly publisher: AmqpPublisher) {}

  async campaignCompleted(campaignId: string): Promise<void> {
    await this.publisher.publish('sender.campaign.completed', { campaignId });
  }

  async emailFailed(campaignId: string, recipientId: string, reason: string): Promise<void> {
    await this.publisher.publish('sender.email.failed', { campaignId, recipientId, reason });
  }
}

// sender.module.ts
{ provide: CAMPAIGN_EVENT_PUBLISHER_PORT, useClass: RabbitMqCampaignEventPublisher }
```

### Pattern 3: Static Factory Methods on DynamicModule

**What:** Foundation modules expose different configurations via static methods like `forPublisher()` vs `forConsumer()` rather than a single `forRootAsync()`.

**When to use:** When the same backing service has fundamentally different usage modes. EventModule is the primary case: publish-only vs consume-only vs both.

**Trade-offs:** More entry points to maintain, but prevents services from importing capabilities they don't need. Sender doesn't need consumer setup. Notifier doesn't need publisher.

**Example (EventModule):**
```typescript
@Module({})
export class EventModule {
  // Provides AMQP_CONNECTION + EVENT_PUBLISHER, no consumer infrastructure
  static forPublisher(): DynamicModule {
    return {
      module: EventModule,
      imports: [TerminusModule],
      providers: [amqpConnectionProvider, publisherProvider, RabbitMqHealthIndicator, amqpHealthProvider],
      exports: [TerminusModule, AMQP_CONNECTION, EVENT_PUBLISHER, AMQP_HEALTH],
    };
  }

  // Provides AMQP_CONNECTION + EVENT_CONSUMER, no publisher
  static forConsumer(): DynamicModule {
    return {
      module: EventModule,
      imports: [TerminusModule],
      providers: [amqpConnectionProvider, consumerProvider, RabbitMqHealthIndicator, amqpHealthProvider],
      exports: [TerminusModule, AMQP_CONNECTION, EVENT_CONSUMER, AMQP_HEALTH],
    };
  }

  // Provides everything -- for services that both publish and consume
  static forRootAsync(): DynamicModule {
    return {
      module: EventModule,
      imports: [TerminusModule],
      providers: [amqpConnectionProvider, publisherProvider, consumerProvider,
                  RabbitMqHealthIndicator, amqpHealthProvider, AmqpShutdownService],
      exports: [TerminusModule, AMQP_CONNECTION, EVENT_PUBLISHER, EVENT_CONSUMER, AMQP_HEALTH],
    };
  }
}
```

### Pattern 4: Circuit Breaker for External HTTP

**What:** A state machine (closed/open/half-open) wrapping HTTP calls to external APIs. After N failures, circuit opens and fast-fails for a cooldown period before allowing probe requests.

**When to use:** External HTTP calls only (parser -> AppStoreSpy, sender -> Google Cloud Proxy, notifier -> Telegram). NOT for internal gRPC -- gRPC has its own deadline/retry mechanism.

**Trade-offs:** Adds failure tracking overhead, but prevents cascade failures from slow/dead external services. Lightweight custom implementation (~80 lines) is preferable to pulling in a full library.

**Implementation:** Build a `CircuitBreaker` class in foundation with three states (CLOSED, OPEN, HALF_OPEN), configurable threshold and reset timeout. Wrap around the HttpClient provider.

## Data Flow

### Current Flow (synchronous gRPC only)

```
Client HTTP
    |
Gateway (REST) --gRPC--> Auth (validate token)
    |
    +--gRPC--> Sender
    +--gRPC--> Parser
    +--gRPC--> Audience
```

### Target Flow (gRPC + RabbitMQ + HTTP + S3)

```
Client HTTP
    |
Gateway (REST) --gRPC--> Auth
    |
    +--gRPC--> Sender --RabbitMQ--> Notifier --HTTP--> Telegram Bot API
    |              |
    |              +--gRPC--> Audience (GetRecipientsByGroup, MarkAsSent)
    |              +--HTTP--> Google Cloud Proxy (send email)
    |              +--S3----> Garage (attachments)
    |
    +--gRPC--> Parser --RabbitMQ--> Audience (batch.ready -> import)
    |              |                    |
    |              +--HTTP--> AppStoreSpy API  +--RabbitMQ--> Notifier
    |              +--S3----> Garage (CSV export)
    |
    +--gRPC--> Audience --S3--> Garage (import/export files)

Correlation ID propagation:
  HTTP header --> gRPC metadata --> AMQP headers --> all log entries
```

### Key Data Flows

1. **Synchronous request-response:** Client -> Gateway (HTTP) -> Service (gRPC) -> Response. Correlation ID flows via gRPC metadata. Circuit breaker NOT applied (gRPC has deadlines).

2. **Async event publishing:** Service completes work -> publishes event to RabbitMQ exchange with routing key -> Notifier/Audience consume. Correlation ID propagated via AMQP message headers.

3. **External HTTP with circuit breaker:** Service -> HttpClientModule (with CircuitBreaker) -> External API. Circuit breaker tracks failures per-target. Fast-fails after circuit opens.

4. **File storage:** Service -> StorageModule (S3Client) -> Garage/MinIO. Used for CSV exports (parser), email attachments (sender), import files (audience).

## Integration with Existing Modules

### What STAYS Unchanged

| Module | Why |
|--------|-----|
| PersistenceModule | Reference implementation, already production-ready |
| LoggingModule | Stable, forHttp/forGrpc/forHttpAsync/forGrpcAsync all work |
| GrpcServerFactory | Server bootstrap is clean, no changes needed |
| Error hierarchy | GrpcException classes, filters are complete |
| Config loader | loadGlobalConfig() pattern stays, env-schema grows |

### What Gets MODIFIED

| Module | Change | Reason |
|--------|--------|--------|
| GrpcClientModule | Add typed service proxy helper for per-service adapters | Currently services register via ClientsModule but have no typed wrapper |
| health/indicators/ | Delete stub files (redis.health.ts, rabbitmq.health.ts) | Real implementations move into CacheModule and EventModule |
| foundation index.ts | Add barrel exports for all new modules | Standard |
| env-schema.ts | Compose sub-schemas for new env vars | New modules need config |
| infrastructure.ts | Split into per-concern sub-schemas (RedisSchema, AmqpSchema, S3Schema) or extend | Config decomposition |

### What Gets CREATED

| Module | Location | Consumers |
|--------|----------|-----------|
| CacheModule | foundation/cache/ | sender, (future: auth for sessions) |
| EventModule | foundation/event/ | sender (publish), parser (publish), audience (consume), notifier (consume) |
| StorageModule | foundation/storage/ | parser, sender, audience, notifier |
| HttpClientModule | foundation/http-client/ | parser, sender, notifier |
| CircuitBreaker | foundation/http-client/ | Wrapped by HttpClientModule |
| TracingModule | foundation/tracing/ | All services |
| GracefulShutdownModule | foundation/shutdown/ | All services |

## Service Module Composition (Target)

### auth.module.ts
```
imports: [AppConfigModule, PersistenceModule.forRootAsync(),
          LoggingModule.forGrpcAsync('auth'), GracefulShutdownModule]
```

### sender.module.ts
```
imports: [AppConfigModule, PersistenceModule.forRootAsync(),
          LoggingModule.forGrpcAsync('sender'),
          EventModule.forPublisher(), CacheModule.forRootAsync(),
          HttpClientModule.forRootAsync(),
          GrpcClientModule.register(SERVICE.audience),
          GracefulShutdownModule]
```

### parser.module.ts
```
imports: [AppConfigModule, PersistenceModule.forRootAsync(),
          LoggingModule.forGrpcAsync('parser'),
          EventModule.forPublisher(), StorageModule.forRootAsync(),
          HttpClientModule.forRootAsync(),
          GracefulShutdownModule]
```

### audience.module.ts
```
imports: [AppConfigModule, PersistenceModule.forRootAsync(),
          LoggingModule.forGrpcAsync('audience'),
          EventModule.forConsumer(), StorageModule.forRootAsync(),
          GracefulShutdownModule]
```

### notifier.module.ts
```
imports: [AppConfigModule, LoggingModule.forHttpAsync('notifier'),
          EventModule.forConsumer(), StorageModule.forRootAsync(),
          HttpClientModule.forRootAsync(),
          GracefulShutdownModule]
```

### gateway.module.ts
```
imports: [AppConfigModule, TerminusModule,
          LoggingModule.forHttpAsync('gateway'),
          ThrottleModule, GrpcClientsModule,
          GracefulShutdownModule]
```

## Build Order (Dependency-Driven)

### Phase 1: Config Decomposition
**Why first:** Every new module reads env vars. The monolithic `InfrastructureSchema` must support modular composition before adding new per-concern schemas.
- Split `InfrastructureSchema` into per-concern schemas: `DatabaseSchema`, `RedisSchema`, `AmqpSchema`, `S3Schema`
- Keep `GlobalEnvSchema` as composition of all sub-schemas
- Rename STORAGE_* env vars to S3_* (or keep both with clear mapping)
- Add circuit breaker env vars: `CIRCUIT_BREAKER_THRESHOLD`, `CIRCUIT_BREAKER_RESET_MS`
- **No consumers yet** -- this is purely config preparation

### Phase 2: CacheModule (Redis)
**Why second:** Simplest new module. Single connection, no pub/sub complexity. `REDIS_URL` already exists in env schema. Redis health stub already exists as reference for replacement.
- Depends on: Config (REDIS_URL already present)
- Blocked by: Nothing
- Consumers: sender (immediate), others (future)
- Replaces: `health/indicators/redis.health.ts` stub

### Phase 3: EventModule (RabbitMQ)
**Why third:** Core async communication. Multiple services need it. More complex than Redis due to publisher vs consumer modes, exchanges, queues, and prefetch.
- Depends on: Config (RABBITMQ_URL already present)
- Blocked by: Nothing critical
- Consumers: sender, parser (publish), audience, notifier (consume)
- Replaces: `health/indicators/rabbitmq.health.ts` stub

### Phase 4: StorageModule (S3)
**Why fourth:** Independent of Redis/RabbitMQ. Parser and notifier need it for file operations.
- Depends on: Config (S3_* vars from Phase 1)
- Blocked by: Config decomposition for env var rename
- Consumers: parser, sender, audience, notifier

### Phase 5: HttpClientModule + Circuit Breaker
**Why fifth:** External HTTP calls. Circuit breaker is the most complex new abstraction. Needs careful design but no dependency on other new modules.
- Depends on: Nothing from previous phases
- Consumers: parser (AppStoreSpy), sender (Google Cloud), notifier (Telegram)

### Phase 6: TracingModule
**Why sixth:** Enhances existing correlation ID propagation to cover gRPC client calls and AMQP message headers. Builds on top of EventModule and GrpcClientModule being functional.
- Depends on: EventModule (AMQP header access), LoggingModule (CLS store)
- Benefits from: All transport modules being ready

### Phase 7: GracefulShutdownModule
**Why seventh:** Needs to know about ALL connections to drain them in order. Must be built after all other modules exist so it can orchestrate their shutdown.
- Depends on: All modules (knows their shutdown hooks and ordering)
- Replaces: All per-service `onModuleDestroy` TODOs currently in service modules

### Phase 8: GrpcClientModule Enhancement + Gateway Integration
**Why last:** Gateway's `GrpcClientsModule` is currently an empty stub. Filling it uses the existing `GrpcClientModule.register()` pattern. Low risk, benefits from all other modules being stable.
- Depends on: GrpcClientModule existing pattern
- Consumers: gateway (all 4 gRPC service clients)

### Dependency Graph

```
Config Decomposition (Phase 1)
    |
    +---> CacheModule (Phase 2)
    |
    +---> EventModule (Phase 3) --------+
    |                                    |
    +---> StorageModule (Phase 4)        +--> TracingModule (Phase 6)
    |                                    |
    +---> HttpClientModule (Phase 5) ---+
    |
    All modules ----> GracefulShutdownModule (Phase 7)
                      GrpcClient Enhancement (Phase 8)
```

## Anti-Patterns

### Anti-Pattern 1: Foundation Modules Exposing Raw Library Types

**What people do:** CacheModule exports `ioredis.Redis` directly, services inject and use it raw.
**Why it's wrong:** Application/domain code becomes coupled to ioredis. Switching to a different Redis client means touching every consumer.
**Do this instead:** Define a `CacheClient` interface in foundation. Export via Symbol token. The provider binds the concrete ioredis instance. Services' outbound ports define their own domain-specific cache interface, adapted from the foundation token.

### Anti-Pattern 2: Putting Business-Aware Routing in Foundation

**What people do:** EventModule knows about `sender.campaign.completed` routing keys.
**Why it's wrong:** Foundation is domain-agnostic. Routing keys are business concepts belonging to each service's domain.
**Do this instead:** EventModule provides a generic `publish(exchange, routingKey, payload, headers)` and `subscribe(queue, routingKey, handler)`. Each service's adapter defines its own routing keys in service-level constants.

### Anti-Pattern 3: Single God Module for All Infrastructure

**What people do:** One `InfrastructureModule` that imports PersistenceModule + CacheModule + EventModule + StorageModule and re-exports everything.
**Why it's wrong:** Gateway needs zero backing services. Notifier needs RabbitMQ but not PostgreSQL. Forces every service to connect to everything.
**Do this instead:** Each service's root module explicitly imports only the foundation modules it needs. The imports list IS the service's infrastructure manifest.

### Anti-Pattern 4: Skipping Health Indicators

**What people do:** Add a new backing service connection but no health check.
**Why it's wrong:** Readiness probes cannot detect a dead connection. Coolify/Kubernetes will not know the service is unhealthy.
**Do this instead:** Every foundation module that opens a connection MUST include a health indicator. Co-locate it with the module, export via a `*_HEALTH` Symbol, consume in the service's HealthController.

### Anti-Pattern 5: Shutdown Without Ordering

**What people do:** Each module implements `OnApplicationShutdown` independently. They race.
**Why it's wrong:** If the HTTP server closes after the DB pool, in-flight requests fail. If RabbitMQ consumer closes before message acknowledgment, messages are redelivered.
**Do this instead:** GracefulShutdownModule orchestrates shutdown order: (1) stop accepting new requests, (2) drain in-flight work, (3) close message consumers, (4) close publishers, (5) close caches, (6) close DB pools.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (6 services, single host) | All modules in single Docker Compose. Single PG, Redis, RabbitMQ instance. Good enough. |
| 10-50 concurrent users | Connection pooling limits per service. Redis for session cache. RabbitMQ prefetch tuning. |
| 100+ concurrent users | Horizontal scaling of stateless services. PgBouncer for connection pooling. RabbitMQ clustering. S3 behind CDN. |

### Scaling Priorities

1. **First bottleneck: PostgreSQL connections.** 6 services x 10 connections = 60. PG default max is 100. At scale, add PgBouncer or reduce `PG_POOL_DEFAULTS.MAX_CONNECTIONS`. Already configurable.
2. **Second bottleneck: RabbitMQ throughput.** If sender processes thousands of emails, publisher confirms and consumer prefetch become critical. EventModule should support publisher confirms from day one.

## Integration Points

### External Services

| Service | Integration Pattern | Module | Notes |
|---------|---------------------|--------|-------|
| Google Cloud Proxy | HTTP POST via HttpClientModule | sender | Circuit breaker critical |
| AppStoreSpy API | HTTP GET via HttpClientModule | parser | Circuit breaker critical |
| Telegram Bot API | HTTP POST via HttpClientModule | notifier | Circuit breaker recommended |
| Garage/MinIO S3 | AWS SDK S3Client via StorageModule | parser, sender, audience, notifier | HeadBucket for health |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Gateway <-> Services | gRPC (sync) | GrpcClientModule.register() per service |
| Sender -> Audience | gRPC (sync) | GetRecipientsByGroup, MarkAsSent |
| Sender -> Notifier | RabbitMQ (async) | campaign.completed, email.failed |
| Parser -> Audience | RabbitMQ (async) | batch.ready -> recipients.imported |
| Parser -> Notifier | RabbitMQ (async) | task.completed |
| Audience -> Notifier | RabbitMQ (async) | recipients.imported |

## Sources

- Codebase analysis: `packages/foundation/src/persistence/` (reference implementation pattern)
- Codebase analysis: all 6 service modules (consumption patterns, current imports)
- Codebase analysis: `packages/config/` (env schema, topology, infrastructure schema)
- Codebase analysis: `packages/foundation/src/health/indicators/` (existing stubs)
- NestJS DynamicModule documentation (HIGH confidence -- well-established, matches existing codebase patterns)
- amqplib connection management patterns (MEDIUM confidence -- training data)
- AWS SDK v3 S3Client patterns (HIGH confidence -- widely documented)
- ioredis connection patterns (HIGH confidence -- widely documented)

---
*Architecture research for: Email Platform v4.0 Infrastructure Abstractions*
*Researched: 2026-04-08*
