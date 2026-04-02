# Architecture Patterns: NestJS Microservices Monorepo with Clean/Hexagonal Architecture

**Domain:** Email platform microservices foundation audit
**Researched:** 2026-04-02
**Confidence:** HIGH (based on direct codebase inspection + established Clean Architecture patterns)

## Recommended Architecture

The target architecture described in `docs/TARGET_ARCHITECTURE.md` is sound. The gap is between that target and the current state. This document defines the correct structural boundaries and identifies what needs fixing.

### Current State vs Target

| Aspect | Target | Current | Gap |
|--------|--------|---------|-----|
| Service internal layers | `domain/`, `application/`, `infrastructure/` | Flat structure: `*.controller.ts`, `*.module.ts`, `health/` | **Critical** -- no layer separation exists |
| Controllers | gRPC adapters in `infrastructure/grpc/` | NestJS `@Controller()` at service root, empty | **Critical** -- wrong location, empty stubs |
| Ports (interfaces) | `application/ports/inbound/` and `outbound/` | Do not exist | **Critical** -- ports are the hex arch cornerstone |
| Use cases | `application/use-cases/` | Do not exist | Expected (scaffold only, no biz logic) |
| Domain layer | `domain/entities/`, `domain/value-objects/`, `domain/events/` | Does not exist | Expected (scaffold only) |
| Proto contracts | Single output in `src/generated/` | Duplicated in `generated/` AND `src/generated/` | **Bug** -- two diverged copies |
| Event contracts | `packages/contracts/events/` with typed interfaces | Do not exist | **Missing** -- events are untyped |
| Config loading | Single load via NestJS DI | `loadGlobalConfig()` called at module scope in every service | **Design flaw** -- module-scope side effects |
| Shared packages | config, contracts, foundation | config, contracts, foundation -- correct | OK |
| Gateway | REST facade with guards, no biz logic | Correct structure but no route controllers yet | Expected |

## Component Boundaries

### Tier 1: Shared Packages (Bottom of Dependency Graph)

These are utility libraries. They must NOT contain business logic or domain concepts.

```
packages/config         -- environment validation, service catalog, topology
packages/contracts      -- proto definitions, generated gRPC types, event type contracts
packages/foundation     -- NestJS infrastructure modules (logging, gRPC helpers, errors, health, resilience)
```

**Dependency rules for packages:**
- `config` depends on: nothing (pure Zod schemas)
- `contracts` depends on: nothing (proto + generated code)
- `foundation` depends on: `config`, `contracts` (needs service declarations and proto paths)

**Current violations found:**
- `foundation` imports from `config` (correct)
- `foundation` does NOT import from `contracts` directly -- it uses `config`'s `GrpcServiceDeclaration` to resolve protos (correct)
- No circular dependencies detected between packages (good)

### Tier 2: Application Services (Top of Dependency Graph)

Each service in `apps/` is an independent deployable unit.

```
apps/gateway    -- REST-to-gRPC facade (no domain layer needed, it is a router)
apps/auth       -- user management, authentication, token lifecycle
apps/sender     -- email campaign orchestration
apps/parser     -- contact data parsing from external APIs
apps/audience   -- recipient and group management
apps/notifier   -- event-driven notification delivery (no gRPC server)
```

**Dependency rules for services:**
- Each service depends on: `config`, `contracts`, `foundation`
- Services NEVER depend on each other's code at compile time
- Inter-service communication is ONLY through gRPC calls or RabbitMQ events
- Each service owns its own MongoDB collections exclusively

**Current violations found:**
- No compile-time cross-service imports detected (good)
- Services do depend on all three packages as expected (good)

### Correct Internal Structure for Domain Services (auth, sender, parser, audience)

```
apps/{service}/src/
  domain/                          -- Pure TypeScript, ZERO framework imports
    entities/                      -- Domain entities with behavior
    value-objects/                 -- Immutable domain primitives
    events/                        -- Domain event definitions
    services/                      -- Domain services (optional)

  application/                     -- Orchestration layer
    ports/
      inbound/                     -- Interfaces that USE CASES implement
        {action}.port.ts           -- e.g., create-campaign.port.ts
      outbound/                    -- Interfaces that ADAPTERS implement
        {name}-repository.port.ts  -- e.g., campaign-repository.port.ts
        {name}.port.ts             -- e.g., event-publisher.port.ts
    use-cases/
      {action}.use-case.ts         -- Implements inbound port, calls outbound ports

  infrastructure/                  -- Framework-aware, external integration
    grpc/
      {service}.grpc-server.ts     -- gRPC inbound adapter (replaces current *.controller.ts)
    persistence/
      mongo-{entity}.repository.ts -- MongoDB outbound adapter
    messaging/
      rabbitmq-event.publisher.ts  -- RabbitMQ outbound adapter
    clients/
      {other-service}.grpc-client.ts -- gRPC client outbound adapter
    external/
      {api-name}.client.ts         -- External HTTP API outbound adapter

  {service}.module.ts              -- NestJS DI wiring (binds ports to adapters)
  main.ts                          -- Bootstrap
```

### Correct Internal Structure for Gateway

Gateway is NOT a domain service. It is a routing facade. No hex arch layers needed.

```
apps/gateway/src/
  controllers/                     -- REST route handlers per domain
    auth.controller.ts             -- /auth/* routes
    sender.controller.ts           -- /sender/* routes
    parser.controller.ts           -- /parser/* routes
    audience.controller.ts         -- /audience/* routes
  guards/
    auth.guard.ts                  -- Calls Auth.ValidateToken, injects UserContext
  interceptors/                    -- Response transformation, logging
  dto/                             -- Request/Response DTOs with class-validator
  gateway.module.ts
  main.ts
```

### Correct Internal Structure for Notifier

Notifier is an event consumer. Simpler than domain services but still follows hex arch.

```
apps/notifier/src/
  domain/
    events/                        -- Event type definitions (consumed events)
  application/
    ports/
      outbound/
        notification-sender.port.ts  -- "send notification" abstraction
        file-storage.port.ts         -- "download file" abstraction
    use-cases/
      handle-campaign-completed.use-case.ts
      handle-parsing-completed.use-case.ts
  infrastructure/
    messaging/
      rabbitmq-event.subscriber.ts   -- Inbound adapter
    external/
      telegram.notification-sender.ts -- Outbound adapter
      minio-file.storage.ts           -- Outbound adapter
  notifier.module.ts
  main.ts
```

## Data Flow

### Synchronous Path (gRPC Request-Response)

```
Frontend
  |
  | HTTPS
  v
Nginx (SSL termination)
  |
  | HTTP :3000
  v
Gateway (REST)
  |-- AuthGuard ---> Auth Service (gRPC :50051) --- validates token
  |
  |-- Route handler translates REST to gRPC call
  |
  v
Domain Service (gRPC :5005x)
  |
  | gRPC controller (inbound adapter)
  v
Use Case (application layer)
  |
  | calls outbound ports
  v
MongoDB Repository (outbound adapter)
  |
  v
MongoDB
```

**Direction:** Outside-in. Infrastructure adapters call application ports. Application calls domain. Domain knows nothing about infrastructure.

### Asynchronous Path (RabbitMQ Events)

```
Domain Service (e.g., Sender)
  |
  | Use case completes
  v
Event Publisher Port (application/ports/outbound/)
  |
  | implemented by
  v
RabbitMQ Publisher Adapter (infrastructure/messaging/)
  |
  | publishes to "events" topic exchange
  v
RabbitMQ
  |
  | routing key: sender.campaign.completed
  v
Consumer Queue (e.g., notifier.campaign)
  |
  | consumed by
  v
RabbitMQ Subscriber Adapter (infrastructure/messaging/)
  |
  | calls use case
  v
Notifier Use Case
  |
  v
Telegram API / S3 (outbound adapters)
```

### Cross-Service gRPC Calls (Sender -> Audience)

```
Sender Use Case (execute-campaign)
  |
  | calls RecipientProviderPort (outbound port)
  v
Audience gRPC Client Adapter (infrastructure/clients/)
  |
  | gRPC call
  v
Audience gRPC Server Adapter (infrastructure/grpc/)
  |
  | calls use case
  v
Audience Use Case (get-recipients-by-group)
  |
  v
Audience MongoDB Repository
```

**Key insight:** Sender never knows it is talking to Audience. It calls a `RecipientProviderPort` interface. The gRPC client adapter is injected via DI. This is how hex arch achieves service isolation.

## Contract Management

### Proto Files as Single Source of Truth

```
packages/contracts/
  proto/
    common.proto       -- Shared messages: Empty, HealthStatus, Pagination
    auth.proto         -- AuthService RPC definitions
    sender.proto       -- SenderService RPC definitions
    parser.proto       -- ParserService RPC definitions
    audience.proto     -- AudienceService RPC definitions
  src/
    generated/         -- ONLY output directory (scripts/generate.sh targets here)
      common.ts
      auth.ts
      sender.ts
      parser.ts
      audience.ts
    index.ts           -- Re-exports all generated types
    proto-dir.ts       -- Runtime path to proto files
```

### Critical Fix: Eliminate Duplicate Generated Directory

Currently there are TWO generated directories:
1. `packages/contracts/generated/` -- older output, diverged (missing HealthCheck in auth)
2. `packages/contracts/src/generated/` -- current output from `scripts/generate.sh`

The `index.ts` exports from `src/generated/` (correct). The top-level `generated/` is orphaned and must be deleted. It creates confusion about which types are authoritative.

### Missing: Event Contract Types

The target architecture specifies `packages/contracts/events/` with typed event interfaces:

```typescript
// packages/contracts/src/events/sender.events.ts
export const SENDER_EVENTS = {
  CAMPAIGN_COMPLETED: 'sender.campaign.completed',
  EMAIL_FAILED: 'sender.email.failed',
  CAMPAIGN_PROGRESS: 'sender.campaign.progress',
} as const;

export interface CampaignCompletedEvent {
  campaignId: string;
  campaignName: string;
  sentCount: number;
  failedCount: number;
  duration: number;
  userId: string;
}
```

This directory does not exist yet. Without typed event contracts, RabbitMQ messages are untyped `any` at boundaries -- defeating the purpose of a contracts package.

## Patterns to Follow

### Pattern 1: Port-Adapter Binding via NestJS Module

**What:** Use NestJS DI tokens to bind outbound port interfaces to concrete adapter implementations.

**When:** Every service module that has use cases calling outbound ports.

**Example:**
```typescript
// application/ports/outbound/campaign-repository.port.ts
export const CAMPAIGN_REPOSITORY = Symbol('CAMPAIGN_REPOSITORY');
export interface CampaignRepositoryPort {
  save(campaign: Campaign): Promise<Campaign>;
  findById(id: string): Promise<Campaign | null>;
}

// infrastructure/persistence/mongo-campaign.repository.ts
@Injectable()
export class MongoCampaignRepository implements CampaignRepositoryPort {
  constructor(@InjectModel('Campaign') private model: Model<CampaignDocument>) {}
  // ...
}

// sender.module.ts
@Module({
  providers: [
    { provide: CAMPAIGN_REPOSITORY, useClass: MongoCampaignRepository },
    CreateCampaignUseCase,
  ],
})
export class SenderModule {}
```

### Pattern 2: gRPC Controller as Thin Inbound Adapter

**What:** The gRPC controller does nothing but translate gRPC messages to use case calls and back. No business logic.

**When:** Every domain service gRPC handler.

**Example:**
```typescript
// infrastructure/grpc/sender.grpc-server.ts
@Controller()
export class SenderGrpcServer implements SenderServiceController {
  constructor(private readonly createCampaign: CreateCampaignUseCase) {}

  @GrpcMethod('SenderService', 'CreateCampaign')
  async createCampaign(request: CreateCampaignRequest): Promise<Campaign> {
    return this.createCampaign.execute(request);
  }
}
```

### Pattern 3: Config as NestJS Provider (Not Module-Scope Call)

**What:** Load config once via NestJS DI instead of calling `loadGlobalConfig()` at module-definition time.

**When:** Everywhere config is needed.

**Why:** Module-scope `const config = loadGlobalConfig()` executes during module import, before NestJS bootstraps. This makes config loading a side effect of importing a module, not a controlled DI operation. It works (because of caching), but it is fragile and breaks testability.

**Current (wrong):**
```typescript
const config = loadGlobalConfig();  // module-scope side effect

@Module({
  imports: [
    LoggingModule.forGrpc(config.LOG_LEVEL, config.LOG_FORMAT),
  ],
})
export class AuthModule {}
```

**Target (correct):**
```typescript
@Module({
  imports: [
    AppConfigModule,
    LoggingModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config) => ({ logLevel: config.LOG_LEVEL, logFormat: config.LOG_FORMAT }),
    }),
  ],
})
export class AuthModule {}
```

This is a design improvement, not a blocker. The current approach works due to caching, but async factory registration is the NestJS-idiomatic pattern.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Business Logic in Controllers

**What:** Putting domain logic directly in gRPC handlers.
**Why bad:** Violates hex arch. Logic becomes coupled to transport. Untestable without gRPC.
**Instead:** Controllers delegate to use cases. Use cases contain orchestration. Domain contains logic.

### Anti-Pattern 2: Cross-Service Database Access

**What:** Service A queries Service B's MongoDB collections directly.
**Why bad:** Destroys service autonomy. Makes it impossible to change B's schema without breaking A.
**Instead:** All cross-service data access goes through gRPC calls or event-driven data transfer.

### Anti-Pattern 3: Importing Domain Types from Another Service

**What:** `apps/sender/` imports entity types from `apps/audience/`.
**Why bad:** Creates compile-time coupling between services. Monolith in disguise.
**Instead:** Shared types go in `packages/contracts/`. Service-specific types stay in that service.

### Anti-Pattern 4: Shared MongoDB Connection String

**What:** All services use the same `MONGODB_URI` and share one database.
**Why bad:** No isolation. Any service can access any collection. Architectural rules are unenforceable.
**Current risk:** The `InfrastructureSchema` has a single `MONGODB_URI`. If all services use the same database, collection ownership is a convention not a boundary.
**Mitigation:** Use per-service databases (e.g., `email_auth`, `email_sender`) or at minimum use NestJS Mongoose connection names to scope models.

## Suggested Audit Order

The fixes have dependency ordering. Fixing in the wrong order creates rework.

### Phase 1: Contracts Cleanup (foundation layer -- everything depends on this)

Fix the contracts package first because every service imports from it.

1. **Delete `packages/contracts/generated/`** -- eliminate the duplicate output directory
2. **Verify `scripts/generate.sh`** outputs only to `src/generated/`
3. **Add `events/` directory** to contracts with typed event interfaces and routing key constants
4. **Ensure proto files include HealthCheck** consistently (auth.proto has it, verify others)

**Rationale:** Contracts are the lowest shared dependency. Fixing them first ensures all services build on a correct foundation. No service changes required yet.

### Phase 2: Config Loading Fix (cross-cutting -- affects all service modules)

1. **Eliminate module-scope `loadGlobalConfig()` calls** in all `*.module.ts` files
2. **Either:** make `LoggingModule` accept async factory config, **or:** accept the current cached approach as a deliberate trade-off and document it
3. **Verify AppConfigModule** provides config via DI correctly

**Rationale:** Config is imported by every service. Fixing the loading pattern before restructuring services avoids redoing module wiring later.

### Phase 3: Service Internal Structure (per-service -- can be parallelized)

For each domain service (auth, sender, parser, audience, notifier):

1. **Create layer directories:** `domain/`, `application/`, `infrastructure/`
2. **Move controller** from `{service}.controller.ts` to `infrastructure/grpc/{service}.grpc-server.ts`
3. **Create port interfaces** in `application/ports/inbound/` and `outbound/`
4. **Create use case stubs** in `application/use-cases/` (no implementation, just empty execute methods)
5. **Update module** to wire ports to (future) adapters
6. **Keep health module** in `infrastructure/` or as standalone (health is infrastructure)

**Order within services (by dependency complexity):**
1. **Auth** -- simplest domain, fewest cross-service dependencies
2. **Notifier** -- event consumer only, no gRPC server
3. **Audience** -- standalone domain, consumed by others but does not call others
4. **Parser** -- external API integration, S3 storage
5. **Sender** -- most complex, calls Audience via gRPC, publishes events
6. **Gateway** -- restructure last (depends on understanding all service contracts)

**Rationale:** Start with the simplest services to establish the pattern, then apply to complex ones. Gateway last because its route structure depends on all other services' contracts being finalized.

### Phase 4: Gateway Restructuring

1. **Create domain-specific controllers:** `auth.controller.ts`, `sender.controller.ts`, etc.
2. **Create AuthGuard** that calls Auth.ValidateToken via gRPC
3. **Create DTOs** with class-validator decorators
4. **Wire gRPC clients** for all domain services

**Rationale:** Gateway is the entry point. Its structure depends on all service contracts being stable. Restructure last.

## Build Order Implications

Turbo's `"dependsOn": ["^build"]` means packages build before apps. The build DAG is:

```
packages/config       (no deps)
packages/contracts    (no deps)
       \                /
        v              v
packages/foundation   (depends on config)
        |
        v
  apps/* (all depend on config, contracts, foundation)
```

**Implication for audit:** Changes to packages require rebuilding all downstream apps. Batch package changes together (Phase 1 + 2) before touching apps (Phase 3 + 4).

**Proto generation** is a pre-build step (`scripts/generate.sh`). It should be a Turbo task that runs before `build` in the contracts package. Currently it appears to be manually triggered.

## Scalability Considerations

| Concern | Current (6 services) | At 20 services | Recommendation |
|---------|---------------------|-----------------|----------------|
| Proto management | 5 proto files, manual generation | Unwieldy manual process | Add proto generation as Turbo task in contracts |
| Shared config schema | Single flat `GlobalEnvSchema` with ALL service env vars | Schema grows unboundedly | Consider per-service config schemas composed into global |
| Foundation package | 20 exports, single barrel index | Becomes a grab-bag | Already well-organized by subdirectory, maintain this |
| Build times | Fast (small codebase) | Turbo caching mitigates | Current Turbo config is correct |
| Event contracts | Missing | Essential at scale | Add now while service count is manageable |

## Sources

- Direct codebase inspection of all `apps/` and `packages/` source files
- `docs/TARGET_ARCHITECTURE.md` -- project's own architectural vision document
- Clean Architecture (Robert C. Martin) -- layer dependency rules
- Hexagonal Architecture (Alistair Cockburn) -- ports and adapters pattern
- NestJS microservices documentation -- gRPC transport, module patterns

---

*Architecture research: 2026-04-02*
