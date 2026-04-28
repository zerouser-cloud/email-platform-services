# Layers

This document describes timeless principles. Do NOT add inventory (specific file paths beyond stable workspace roots, port numbers, class names, enumerated counts of files / services / overrides). For current-state lookups, link to a tracked config file by role, link to an enclosing directory (not a file), or provide a `grep` command the reader runs on demand. Every assertion here must survive the rename test — would this sentence still be true after any referenced file / class / number were renamed or changed?

The three Hexagonal layers inside `apps/{svc}/src/` for a gRPC microservice. Each subfolder below has a fixed purpose and a fixed list of allowed imports. Violations are caught by the project's ESLint overrides (see the project ESLint configuration at the repository root for the current override set and path globs) and by file-structure review.

`infrastructure/` partitions into three direction sub-bins, each with a distinct semantic role — `inbound/` (primary / driving adapters), `outbound/` (secondary / driven adapters), `bootstrap/` (Ring-4 framework glue + composition-root artefacts). Feature slicing is per aggregate / upstream / vendor / concern inside each bin. For the current per-service canonical tree in this project, see CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" — that section is the file-path source of truth.

---

## Infrastructure Layer (`apps/{svc}/src/infrastructure/`)

The outermost ring. Talks to the outside world: gRPC server, HTTP server, PostgreSQL, S3, outbound gRPC clients, external vendor APIs, RabbitMQ. Implements outbound ports from `application/ports/outbound/`. Uses proto types, NestJS decorators, and Drizzle ORM freely.

`infrastructure/` partitions into three direction sub-bins, each with a distinct semantic role:

- **`infrastructure/inbound/`** — primary / driving adapters (Cockburn). Translate external input into application ports.
- **`infrastructure/outbound/`** — secondary / driven adapters (Cockburn). Implement outbound ports; translate domain → external.
- **`infrastructure/bootstrap/`** — Uncle Bob Ring-4 framework glue + Seemann composition-root artefacts. NOT adapters.

Each bin is feature-sliced by a stable axis (transport for inbound, integration for outbound, concern for bootstrap).

---

## Infrastructure / Bootstrap (`apps/{svc}/src/infrastructure/bootstrap/`)

Ring-4 framework glue per Uncle Bob + Seemann composition-root artefacts. NOT adapters. Houses the NestJS DynamicModule machinery that assembles the app: config, health, rate-limit throttle (REST-ingress services only), logging (optional). The bootstrap ring is what `main.ts` indirectly boots — the root `{svc}.module.ts` composes it as the FIRST imports in the root module.

### `bootstrap/config/`

Where it lives: `apps/{svc}/src/infrastructure/bootstrap/config/`

**Artefact roles.** Each service owns a co-located slice of composition-root artefacts that together bind a typed configuration object into the DI container:

- A **config DI token** — a `Symbol()`, scoped to the bounded context (cross-folder token for consumers inside this service only).
- A **per-service Zod env schema** — composed from shared primitives exposed by `packages/config`. No defaults, no optionals (per the `env-schema` skill). The schema may physically live in the config package rather than the app directory — see the config-factory principle below for which artefact is required inside this slice and which is imported from elsewhere.
- A **`@Global()` `DynamicModule`** — binds the config token to the validated env, exports the token plus any narrow config ports the service consumes. Must be imported FIRST in the root module's `imports:[]` so nested foundation modules using `forRootAsync({ inject: [CONFIG_PORT] })` can resolve the Symbol across nested injector scopes.
- A **barrel** re-exporting the module.

**Where they live together.** All artefacts that belong to *this service's* composition-root config live inside the one directory above. Open the directory to see the current file set — the directory is the source of truth; individual file names drift across refactors.

**Ordering rule.** The config module is imported FIRST in the root `imports:[]`. If it is not global or not first, nested `forRootAsync({ inject })` calls cannot resolve the token and the app fails at startup.

**Config-factory principle** (reusable wording — paired skill `infrastructure-client-layering` §Config → "Apps" mirrors this).

> A foundation factory accepts (a) a Zod schema, (b) a config DI token, and (c) a set of narrow config ports the service exposes, and returns a ready `@Global() DynamicModule`. The app-level config module is the result of calling the factory — not a hand-rolled class with `static forRoot()`. Consumers inject the token and receive a validated, typed config object. When a narrow port is introduced, it is added to the factory call; no bespoke provider wiring is written by hand.

Directory-level link for the factory's enclosing directory: `packages/foundation/src/external/config/` — open the directory to see the current factory + load helpers. The factory function name is intentionally omitted here per the rename-test — use the directory as the entry point.

- Allowed imports: `zod`, `@email-platform/config` global schema primitives, `@nestjs/common` (for `@Global()` + DynamicModule), the foundation config factory.
- **Forbidden imports:** proto types, `@nestjs/microservices`, Drizzle, `application/`, `domain/`.

Full treatment: `.agents/skills/infrastructure-client-layering/SKILL.md` §Config.

### `bootstrap/health/`

Where it lives: `apps/{svc}/src/infrastructure/bootstrap/health/`

**Artefact roles.**

- A **health module** wrapping the Terminus `forRootAsync()` machinery and declaring the health controller.
- A **health controller** — a standard NestJS REST controller at path `/health`, exposing liveness and readiness probes via `@nestjs/terminus`'s `HealthCheckService` plus foundation-provided health indicators.
- A **barrel** re-exporting the module.

Open the directory to see the current file names. Health is Ring-4 framework glue (liveness / readiness for Kubernetes probes), NOT a business feature — so it does NOT live under `inbound/rest/`.

- Allowed imports: `@nestjs/common`, `@nestjs/terminus`, foundation health primitives, local constants.
- **Forbidden imports:** proto types, `@nestjs/microservices`.

### `bootstrap/throttle/` (REST-ingress services only)

Where it lives: `apps/{svc}/src/infrastructure/bootstrap/throttle/` — present only in services that own a public HTTP ingress.

**Artefact roles.**

- A **throttle module** wrapping `ThrottlerModule.forRootAsync({ inject: [{SVC}_CONFIG] })` and registering an `APP_GUARD`.
- **Local constants** holding any throttle-specific Symbol tokens.
- A **barrel** re-exporting the module.

Only REST-ingress services use rate limiting; gRPC services and pure RMQ consumers have no analogous module. Rate-limiting is Ring-4 glue (a cross-cutting guard at the HTTP boundary), so it lives under `bootstrap/` rather than as a feature submodule.

### `bootstrap/logging/` (optional)

Reserved slot for service-specific logging interceptors. The shared `LoggingModule.forGrpcAsync('{svc}')` / `LoggingModule.forHttpAsync('{svc}')` lives in foundation; apps import it from `@email-platform/foundation`. A service-local `bootstrap/logging/` would host custom interceptors if they emerged — do not create an empty placeholder when no service-local interceptor exists.

---

## Infrastructure / Inbound (`apps/{svc}/src/infrastructure/inbound/`)

Primary / driving adapters (Cockburn). Translate external input (gRPC call / REST request / RabbitMQ message) into domain Command DTOs and call an inbound application port. Feature-sliced by transport; within a transport, sliced by proto service (for gRPC) / REST feature / event type (for RMQ).

### `inbound/grpc/`

Where it lives: `apps/{svc}/src/infrastructure/inbound/grpc/`

**Artefact roles.**

- A **gRPC controller** — `@Controller()` + the ts-proto-generated `@{Svc}ServiceControllerMethods()` decorator + `implements {Svc}ServiceController` (the ts-proto-generated interface). **ONE controller file per proto service** — the NestJS `@GrpcMethod` idiom binds a single class to a proto service.
- A **feature composer module** (typically `grpc.module.ts`) — declares the controller, imports foundation modules the controller needs, binds inbound-port Symbols to application services, and hosts related application providers when the composer owns that slice.
- A **barrel** re-exporting the module.

Controller responsibilities:

- Injects inbound ports by Symbol token. Field name reflects runtime identity (see `references/NAMING.md` §Field Naming Rules), type carries the `Port` suffix, token carries `_PORT`.
- Owns the proto↔domain mapping. Every method body builds a `Command` from the proto request, awaits the port, projects the domain `Result` back to a proto response. See `references/CALL-FLOW.md` + `references/PROTO-VISIBILITY.md`.
- Allowed imports: `@nestjs/common`, `@nestjs/microservices`, `@email-platform/contracts`, application ports + commands, local constants (Symbol tokens).
- **Forbidden imports:** Drizzle, `domain/entities/*` directly (entities arrive via port results).

### `inbound/rest/{feature}/` (reserved)

Where it would live: `apps/{svc}/src/infrastructure/inbound/rest/{feature}/` — the enclosing `inbound/rest/` directory exists the moment any REST feature endpoint does.

Future scaffold for REST-ingress business features (a login endpoint, a campaigns API, etc.). When a REST feature arrives, it creates a new `{feature}/` sub-slice with a feature-scoped controller + module. Reserved folder — do not create empty placeholders.

**HealthController is NOT in `inbound/rest/`** — it lives in `bootstrap/health/`. Rationale: health is framework glue (Ring-4), not a business feature adapter.

### `inbound/rmq/`

Where it lives: `apps/{svc}/src/infrastructure/inbound/rmq/` — present in services that consume RMQ events.

**Artefact roles.**

- One or more **event consumer classes** bound by `@EventPattern()` / `@MessagePattern()` decorators, translating the event payload into a `Command` and calling an inbound port. Feature-slice per event type when multiple event patterns accumulate (`{event-type}.consumer.ts`).
- A **feature composer module** tying the consumer(s) to the application ports.
- A **barrel** re-exporting the module.

- Allowed imports: `@nestjs/common`, `@nestjs/microservices` (for `@EventPattern()`), `@email-platform/contracts` (event payload types), application ports + commands, local constants.
- **Forbidden imports:** Drizzle, `domain/entities/*` directly.

---

## Infrastructure / Outbound (`apps/{svc}/src/infrastructure/outbound/`)

Secondary / driven adapters (Cockburn). Implement outbound application ports; translate domain → external system. Feature-sliced per integration: per aggregate (persistence), per upstream service (grpc-clients), per vendor (http-clients), per bucket/namespace (storage), per event type (publishers — future).

Every outbound category with more than one sub-slice has a **category-level composer module** that aggregates the per-feature sub-modules. The root `{svc}.module.ts` imports the composer, never individual sub-slices.

### `outbound/persistence/{aggregate}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/persistence/{aggregate}/`

**Artefact roles (per aggregate).**

- A **per-aggregate module** binding `{AGGREGATE}_REPOSITORY_PORT → Pg{Aggregate}Repository` and importing the foundation `PersistenceModule.forRootAsync()` so the `DRIZZLE` token is visible to the repository.
- A **repository adapter** `implements {Aggregate}RepositoryPort`. Uses Drizzle via `@Inject(DRIZZLE)` from foundation and delegates row↔entity translation to a mapper.
- A **mapper** — a plain `const {Aggregate}Mapper = { toDomain(row), toPersistence(entity) }`. **Const object, not a class.** No `@Injectable()`, no NestJS DI — mappers are pure functions. Infers Drizzle row types via `$inferSelect` / `$inferInsert`. Created once a real Drizzle row→entity translation exists; stub repositories may omit the mapper slot until real persistence lands. The mapper lives under a `mappers/` sub-folder inside the aggregate slice.
- A **Drizzle schema** — `pgSchema('{service}').table(...)` definitions under a `schema/` sub-folder. `pgSchema` per service provides namespace isolation.
- A **barrel** re-exporting the module.

Category composer: the `persistence/` category-composer module imports all per-aggregate modules.

- Repository allowed imports: `@nestjs/common`, `drizzle-orm`, `drizzle-orm/node-postgres`, foundation `DRIZZLE` token, outbound port interfaces, mapper consts, schema consts.
- Repository **forbidden imports:** proto types, `@nestjs/microservices`, `application/services/*`, `application/use-cases/*`.
- Mapper allowed imports: local schema types, `domain/entities/{entity}.entity`.
- Mapper **forbidden imports:** proto types, `@nestjs/*` (including DI decorators), anything from `application/`.
- Schema allowed imports: `drizzle-orm/pg-core` primitives.
- Schema **forbidden imports:** anything from `application/`, `domain/`, proto types, NestJS.

### `outbound/grpc-clients/{upstream}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/grpc-clients/{upstream}/`

**Artefact roles (per upstream).**

- A **per-upstream client module** — a thin module calling the foundation gRPC-client factory with the upstream's service identity (taken from the config catalog) and re-exporting the named DI tokens (client token + health token) that the factory binds.
- A **barrel** re-exporting the module.

Consumer code injects the promisified proto client directly; no per-app client class and no per-app client-constants file. The `infrastructure-client-layering` skill §gRPC owns the full client-side treatment.

Category composer: the `grpc-clients/` category-composer module imports all per-upstream modules.

- Allowed imports: `@nestjs/common`, foundation gRPC primitives, `@email-platform/config` service catalog, `@email-platform/contracts` proto types (passed as type argument to the factory).
- **Forbidden imports:** local `application/` or `domain/` files (clients are leaf adapters consumed via DI).

### `outbound/http-clients/{vendor}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/http-clients/{vendor}/`

**Artefact roles (per vendor).**

- A **vendor client class** — may extend a foundation HTTP-client base class (HTTP clients are not restricted the way gRPC clients are — see the project ESLint overrides for the current rules).
- A **vendor module** wiring the client with env config.
- **Vendor-local constants** — a Symbol token file for the vendor's DI bindings.
- Optionally, an **outbound-port adapter** translating domain → vendor call when the vendor integration satisfies a named outbound port (e.g., a notification sender).
- A **barrel** re-exporting the module.

Category composer: the `http-clients/` category-composer module imports all per-vendor modules.

### `outbound/storage/{bucket-or-namespace}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/storage/{slice}/`

**Artefact roles (per bucket / namespace).**

- A **storage module per bucket** wiring the foundation S3 primitives with the per-bucket credentials and namespace. A service may own more than one bucket module when it interacts with multiple buckets (private own-data + shared reports, etc.) — legitimate composition, not duplication.

Category composer: the `storage/` category-composer module imports all per-slice modules.

### `outbound/publishers/{event-type}/` (reserved)

Reserved slot for event publishers. When introduced, each event type gets its own feature slice. Placeholder only — do not create empty folders.

---

## Application Layer (`apps/{svc}/src/application/`)

The orchestration ring. Defines **what** the service does, independent of **how** it's delivered (gRPC) or **where** data comes from (PostgreSQL). Works entirely in domain types.

**Hard rule:** no `@email-platform/contracts` imports, no `@nestjs/microservices` imports — enforced by the project's ESLint application-isolation override (see the project ESLint config).

### `ports/inbound/`

Where it lives: `apps/{svc}/src/application/ports/inbound/{feature}.port.ts`

Template: `export interface {Feature}Port { execute(cmd: {Feature}Command): Promise<{Feature}Result> }`.

- Pure TypeScript interface — this is OUR contract, not a generated one.
- One port per RPC method.
- Always shape `execute(cmd: XxxCommand): Promise<XxxResult>` — Command DTO in, Result out.
- `Result` is a sibling interface declared in the same file (or imported from domain types).
- Allowed imports: Command classes, domain types (entities, value objects).
- **Forbidden imports:** proto types, `@nestjs/*` decorators, Drizzle.

### `ports/outbound/`

Where it lives: `apps/{svc}/src/application/ports/outbound/{entity}-repository.port.ts`

Template: `export interface {Entity}RepositoryPort { findBy...(): Promise<{Entity} | null>; save({entity}): Promise<void> }`.

- Interface for infrastructure adapters to implement (persistence, external APIs, message publishers).
- Named with `Port` suffix.
- Allowed imports: domain types only.
- **Forbidden imports:** proto types, Drizzle, NestJS, any infrastructure-level type.

### `services/`

Where it lives: `apps/{svc}/src/application/services/{feature}.service.ts`

Template: class `{Feature}Service implements {Feature}Port` — one file per inbound port.

- **Composition layer** — implements the inbound port, orchestrates one or more use cases.
- Decorated `@Injectable()` (NestJS DI).
- Injects use cases via constructor parameters (plain class injection, no Symbol token needed — use cases are providers by class reference).
- Per-feature granularity: one service = one inbound port = one RPC method. Never one giant `{Svc}ApplicationService` with all methods.
- Even if today's implementation is pure delegation (`return this.useCase.execute(cmd)`), the layer stays — it's the seam for future cross-cutting (logging, transactions, event emission).
- Allowed imports: `@nestjs/common`, inbound port interface, Command classes, use case classes, domain types.
- **Forbidden imports:** proto types, `@nestjs/microservices`, Drizzle, infrastructure repositories directly.

### `use-cases/`

Where it lives: `apps/{svc}/src/application/use-cases/{operation}.use-case.ts`

Template: class `{Operation}UseCase` — one file per atomic business step.

- **Atomic operation** — one business step, reusable across services within the same bounded context.
- Decorated `@Injectable()` (NestJS DI).
- Does NOT `implements` any port (the service does that). Use case is a plain injectable class.
- Injects outbound ports via Symbol tokens. Field name reflects the runtime role; type retains the `Port` suffix; token retains `_PORT`.
- Signature: `execute(cmd: SomeCommand): Promise<SomeResult>` OR simpler positional arguments for pure internal use cases that a Service composes (e.g., `execute(entity: SomeEntity): Promise<SomeResult>` — when the use case is never a direct inbound port entry).
- Allowed imports: `@nestjs/common`, outbound port interfaces, local constants (Symbol tokens), domain types, Command classes.
- **Forbidden imports:** proto types, `@nestjs/microservices`, Drizzle, infrastructure adapters directly.

### `commands/`

Where it lives: `apps/{svc}/src/application/commands/{feature}.command.ts`

Template: class `{Feature}Command` — POJO DTO carrying every input for one invocation.

- POJO class with `readonly` fields — constructor captures every input.
- Purpose: carry all input arguments for a service/use-case invocation as one named object.
- Scalable: adding a field does not break existing `execute(cmd)` call sites.
- Foundation for future `class-validator` decorators when real validation lands.
- Allowed imports: domain types (if a Command field is a VO).
- **Forbidden imports:** proto types, `@nestjs/*`, Drizzle.

---

## Domain Layer (`apps/{svc}/src/domain/`)

The innermost ring. Pure TypeScript. Zero framework dependencies. If you deleted NestJS tomorrow, this folder compiles.

**Hard rule:** no `@nestjs/*`, no `@email-platform/contracts`, no `drizzle-orm`, no `pg*` imports. Enforced by the project's ESLint domain-isolation override (see the project ESLint config).

### `entities/`

Where it lives: `apps/{svc}/src/domain/entities/{entity}.entity.ts`

Template: class `{Entity}` — POJO with `readonly` fields and a constructor; no decorators.

- Business invariants belong here as methods.
- Allowed imports: other domain types (value objects, domain services).

### `value-objects/` (optional)

Where it lives: `apps/{svc}/src/domain/value-objects/{vo}.vo.ts`

Template: class `{ValueObject}` with validation in the constructor (throws if invalid); `.vo.ts` suffix distinguishes VOs from entities.

- Immutable class.
- Introduced only when real business logic arrives (YAGNI).

### `services/` (optional)

Where it lives: `apps/{svc}/src/domain/services/{name}.ts`

Template: a class named for its purpose (e.g., a hasher, a validator, a policy). Stateless business logic that does not belong on an entity.

- May be `@Injectable()` ONLY if the service needs NestJS DI (e.g., injecting an external adapter). Otherwise plain class.
- **Exception:** when `@Injectable()` is present, the class must still be framework-agnostic in logic — only DI wiring uses the decorator.

### `events/` (optional)

Where it lives: `apps/{svc}/src/domain/events/{event}.event.ts`

Template: class `{Event}Event` — plain POJO emitted by domain methods, projected to RabbitMQ by infrastructure publishers.

---

## Composition Root (`apps/{svc}/src/{svc}.module.ts`)

One flat `@Module` per bounded context. No feature submodules (no `{Feature}Module` per feature). The root module imports **feature-module composers only** (never individual controllers/providers); feature modules from the three direction sub-bins own their own DI.

Illustrative shape (fictional `FooService` — names are placeholders, not production):

```ts
@Module({
  imports: [
    FooConfigModule,                            // bootstrap/config/ — FIRST (@Global); result of calling the config factory
    FooHealthModule,                            // bootstrap/health/
    LoggingModule.forGrpcAsync('foo'),          // foundation — service identifier comes from the config catalog
    FooPersistenceModule,                       // outbound/persistence/ category composer
    FooGrpcModule,                              // inbound/grpc/ — declares FooController
  ],
  // controllers: [] — empty or near-empty (controllers live inside inbound/ composer modules)
  providers: [
    // Zone 1: outbound port bindings (may also live in per-aggregate *.module.ts files)
    { provide: BAR_REPOSITORY_PORT, useClass: PgBarRepository },

    // Zone 2: inbound port → service bindings (may also live in inbound/grpc/ composer)
    { provide: DO_THING_PORT,   useClass: DoThingService },
    { provide: DO_OTHER_PORT,   useClass: DoOtherService },
    // ... one per RPC method

    // Zone 3: use cases as plain providers (no port binding)
    ComputeXUseCase,
    PersistYUseCase,
    // ... as needed
  ],
})
export class FooModule {}
```

REST-facade services (no inbound gRPC; outbound gRPC only) replace the inbound composer with an outbound `GrpcClientsModule` and typically add `ThrottleModule` under `bootstrap/throttle/`. RMQ-consumer services replace the inbound `GrpcModule` with an inbound `RmqModule`. Each shape is a legitimate variance on the skeleton, not a deviation.

For the current per-service shape of this project, see CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" or read the service's root module:

```bash
# Current composition root of every service in the workspace:
grep -n '@Module' apps/*/src/*.module.ts
```

---

## DI Tokens (`apps/{svc}/src/{svc}.constants.ts`)

Plain `Symbol('XxxPort')` — **not** `Symbol.for('XxxPort')`. Each service's tokens live in its own `{svc}.constants.ts` file, scoped to that bounded context. Cross-service token sharing is forbidden.

Illustrative shape (fictional `FooService`):

```ts
// apps/foo/src/foo.constants.ts
export const BAR_REPOSITORY_PORT = Symbol('BarRepositoryPort');

export const DO_THING_PORT   = Symbol('DoThingPort');
export const DO_OTHER_PORT   = Symbol('DoOtherPort');
// ... one per RPC method
```

Why `Symbol()` not `Symbol.for()`: per-service scope means no global registry collision risk, and plain `Symbol()` creates a unique-per-declaration token that cannot be fabricated by a consumer who happens to know the string key.

See `.agents/skills/no-magic-values/SKILL.md` for the general rule.

### Composition-root-only services

A service whose composition root owns no cross-folder domain-port Symbols (for example, a REST facade that forwards to outbound gRPC without any application ports of its own) has **no root `{svc}.constants.ts`** — the file is created only when a Symbol needs to cross folders within that bounded context. When reading skill references to `{svc}.constants.ts`, treat it as conditional: a service owns the file only if it owns domain-port Symbols.

---

## Canonical Tree

This skill does not enumerate the current file tree per service — the tree drifts with every per-aggregate or per-upstream addition. Open the service's directory, open CLAUDE.md §"NestJS↔Hexagonal Layer Mapping", or use the following grep commands to reconstruct the current shape on demand:

```bash
# All infrastructure direction sub-bins currently in use per service:
find apps/*/src/infrastructure -maxdepth 2 -type d | sort

# All aggregate slices currently under outbound/persistence:
find apps/*/src/infrastructure/outbound/persistence -maxdepth 2 -type d | sort

# All upstream slices currently under outbound/grpc-clients:
find apps/*/src/infrastructure/outbound/grpc-clients -maxdepth 2 -type d | sort

# All inbound transports currently in use:
find apps/*/src/infrastructure/inbound -maxdepth 2 -type d | sort

# All application ports currently declared:
find apps/*/src/application/ports -type f | sort
```

**Timeless skeleton.** The shape below describes the *role* of each slot in the tree. The full list of files in a given slot lives under the enclosing directory — open it to see the current set.

```
apps/{svc}/
├── src/
│   ├── main.ts                                           (process entry point)
│   ├── {svc}.module.ts                                   (composition root — flat @Module)
│   ├── {svc}.constants.ts                                (cross-folder domain-port Symbols, when any exist)
│   │
│   ├── infrastructure/
│   │   ├── bootstrap/                                    (Ring-4 glue: config, health, throttle, logging)
│   │   │   ├── config/                                   (per-service config slice — artefact roles described above)
│   │   │   ├── health/                                   (liveness + readiness controller + module)
│   │   │   ├── throttle/                                 (REST-ingress services only)
│   │   │   └── logging/                                  (optional — service-local interceptors)
│   │   ├── inbound/                                      (primary adapters — transport-sliced)
│   │   │   ├── grpc/                                     (gRPC server services)
│   │   │   ├── rest/{feature}/                           (reserved per feature — REST ingress)
│   │   │   └── rmq/                                      (RMQ consumer services)
│   │   └── outbound/                                     (secondary adapters — integration-sliced)
│   │       ├── persistence/{aggregate}/                  (one slice per aggregate)
│   │       ├── grpc-clients/{upstream}/                  (one slice per upstream service)
│   │       ├── http-clients/{vendor}/                    (one slice per external vendor)
│   │       ├── storage/{bucket-or-namespace}/            (one slice per bucket / namespace)
│   │       └── publishers/{event-type}/                  (reserved — one slice per event type)
│   │
│   ├── application/
│   │   ├── ports/inbound/        {feature}.port.ts       (one per RPC method / event handler)
│   │   ├── ports/outbound/       {entity}-repository.port.ts
│   │   ├── services/             {feature}.service.ts    (implements inbound port)
│   │   ├── use-cases/            {operation}.use-case.ts (atomic step)
│   │   └── commands/             {feature}.command.ts    (DTO)
│   │
│   └── domain/
│       ├── entities/                                     (POJO entities)
│       ├── value-objects/                                (optional)
│       ├── services/                                     (optional)
│       └── events/                                       (optional)
│
└── package.json
```

**Per-service variance.** A service may or may not have a given inbound transport, a given outbound integration, a given bootstrap slot, or a given domain sub-folder — the presence of each slot is driven by what the service actually does. Absence of a slot is not a violation; invention of a new slot outside this skeleton is. CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" records the current per-service variance for this project.

Sources of this skeleton + rules:
- CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" — paired doc, current file-path matrix for this project.
- Phase CONTEXT and PLAN documents under `.planning/phases/` — historical decisions behind the shape.

This skeleton is the canonical pattern — concrete deviations inside the slots above are legitimate variance; inventions outside the slots are violations.

---

## See Also

- CLAUDE.md §"NestJS↔Hexagonal Layer Mapping" — project-level authoritative file-path matrix (paired doc).
- `.agents/skills/infrastructure-client-layering/SKILL.md` §Config — the config-factory principle's client-side counterpart.
- `references/NAMING.md` §Field Naming Rules — naming conventions for DI-injected fields referenced throughout this document.
