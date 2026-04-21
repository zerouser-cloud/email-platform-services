# Layers

The three Hexagonal layers inside `apps/{svc}/src/` for a gRPC microservice (auth / sender / parser / audience shape). Each subfolder below has a fixed purpose and a fixed list of allowed imports. Violations are caught by ESLint Overrides 6 + 7 + 8 + 9 (`.eslintrc.js` — paths refreshed in Phase 999.11.2 Plan 08) and by file-structure review.

Reference Phase: 999.10 (3-layer server-side stack). Refinement Phase: 999.11.2 (direction split of `infrastructure/` into three sub-bins: `inbound/`, `outbound/`, `bootstrap/` + feature slicing per aggregate / upstream / vendor / concern). Reference service: `apps/auth/` (pilot — 999.10 Plan 02 + 999.11.2 Plan 02).

---

## Infrastructure Layer (`apps/{svc}/src/infrastructure/`)

The outermost ring. Talks to the outside world: gRPC server, HTTP server, PostgreSQL, S3, outbound gRPC clients, external vendor APIs, RabbitMQ. Implements outbound ports from `application/ports/outbound/`. Uses proto types, NestJS decorators, and Drizzle ORM freely.

Since Phase 999.11.2, `infrastructure/` partitions into three direction sub-bins, each with a distinct semantic role:

- **`infrastructure/inbound/`** — primary / driving adapters (Cockburn). Translate external input into application ports.
- **`infrastructure/outbound/`** — secondary / driven adapters (Cockburn). Implement outbound ports; translate domain → external.
- **`infrastructure/bootstrap/`** — Uncle Bob Ring-4 framework glue + Seemann composition-root artefacts. NOT adapters.

Each bin is feature-sliced by a stable axis (transport for inbound, integration for outbound, concern for bootstrap).

---

## Infrastructure / Bootstrap (`apps/{svc}/src/infrastructure/bootstrap/`)

Ring-4 framework glue per Uncle Bob + Seemann composition-root artefacts. NOT adapters. Houses the NestJS DynamicModule machinery that assembles the app: config, health, throttle (gateway only), logging (optional). The bootstrap ring is what `main.ts` indirectly boots — the root `{svc}.module.ts` composes it as the FIRST imports in the root module.

### `bootstrap/config/`

Where it lives: `apps/{svc}/src/infrastructure/bootstrap/config/`
Canonical files: `{svc}-config.constants.ts` + `{svc}-env.schema.ts` + `{svc}-config.provider.ts` + `{svc}-config.module.ts` + `index.ts`.

Four-file slice per the **Canonical Config Access Contract** (Phase 999.11.1 D-08..D-12, placement refinement 999.11.2):

- `{svc}-config.constants.ts` — `export const {SVC}_CONFIG = Symbol('{SVC}_CONFIG')` (cross-folder DI token).
- `{svc}-env.schema.ts` — Zod schema composed from `packages/config` sub-schemas. No defaults, no optionals (per `env-schema` skill).
- `{svc}-config.provider.ts` — `{svc}ConfigProvider = { provide: {SVC}_CONFIG, useValue: loadConfig({Svc}EnvSchema) }`.
- `{svc}-config.module.ts` — `@Global() @Module({})` with `static forRoot(): DynamicModule` returning the provider + every narrow `*_CONFIG_PORT` slice (D-10 of 999.11.1 — slicing by feature reduces coupling).
- `index.ts` — barrel re-exporting the module.

**{Svc}ConfigModule MUST be FIRST in the root `imports:[]`**, before any foundation module that uses nested `SomeExternalModule.forRootAsync({ inject: [CONFIG_PORT] })` — without `@Global()` those nested injector scopes cannot resolve the Symbol.

- Allowed imports: `zod`, `@email-platform/config` global schema primitives, `@nestjs/common` (for `@Global()` + DynamicModule).
- **Forbidden imports:** proto types, `@nestjs/microservices`, Drizzle, `application/`, `domain/`.

Full treatment: `.agents/skills/infrastructure-client-layering/SKILL.md` §Config + its §Phase 999.11.2 refinement subsection.

### `bootstrap/health/`

Where it lives: `apps/{svc}/src/infrastructure/bootstrap/health/`
Canonical files: `health.module.ts` + `health.controller.ts` + `index.ts`.

- `health.module.ts` wraps `TerminusModule.forRootAsync()` and declares the HealthController.
- `health.controller.ts` is a standard NestJS REST controller: `@Controller('health')` + `@Get(HEALTH.LIVE)` / `@Get(HEALTH.READY)`. Uses `@nestjs/terminus` `HealthCheckService` + service-specific health indicators (`DatabaseHealthIndicator` etc. from foundation).
- `index.ts` — barrel re-exporting HealthModule.

Present in all 6 services (D-08 from Phase 999.11.2). Before 999.11.2 HealthController lived under the old `controllers/rest/` sub-bin (4 services) or the anti-pattern `src/health/` outlier (gateway, notifier) — now uniformly in `bootstrap/health/`. Health is Ring-4 framework glue (liveness / readiness for Kubernetes probes), NOT a business feature — so it does NOT live under `inbound/rest/`.

- Allowed imports: `@nestjs/common`, `@nestjs/terminus`, foundation health primitives, local constants.
- **Forbidden imports:** proto types, `@nestjs/microservices`.

### `bootstrap/throttle/` (gateway only)

Where it lives: `apps/gateway/src/infrastructure/bootstrap/throttle/`
Canonical files: `throttle.module.ts` + `throttle.constants.ts` + `index.ts`.

- `throttle.module.ts` — `ThrottlerModule.forRootAsync({ inject: [GATEWAY_CONFIG] })` registering `APP_GUARD`.
- `throttle.constants.ts` — local token Symbols.
- `index.ts` — barrel.

Only the gateway uses rate limiting (REST ingress). The 4 gRPC services and notifier have no analogous module. Before 999.11.2 this lived at `gateway/src/throttle/` (feature submodule anti-pattern — violates "one flat module per bounded context"); since 999.11.2 it is under bootstrap/ as Ring-4 glue.

### `bootstrap/logging/` (optional — currently empty)

Reserved for service-specific logging interceptors. The shared `LoggingModule.forGrpcAsync('{svc}')` / `LoggingModule.forHttpAsync('{svc}')` lives in foundation; apps import it from `@email-platform/foundation`. A service-local `bootstrap/logging/` would host custom interceptors if they emerged. Currently no service has this slice.

---

## Infrastructure / Inbound (`apps/{svc}/src/infrastructure/inbound/`)

Primary / driving adapters (Cockburn). Translate external input (gRPC call / REST request / RabbitMQ message) into domain Command DTOs and call an inbound application port. Feature-sliced by transport; within a transport, sliced by proto service (for gRPC) / REST feature / event type (for RMQ).

### `inbound/grpc/`

Where it lives: `apps/{svc}/src/infrastructure/inbound/grpc/`
Canonical files: `{svc}.controller.ts` + `grpc.module.ts` + `index.ts`.

Present in 4 services: auth, sender, parser, audience.

- `{svc}.controller.ts` — `@Controller()` + `@{Svc}Proto.{Svc}ServiceControllerMethods()` + `implements {Svc}Proto.{Svc}ServiceController` (ts-proto-generated interface). **ONE controller file per proto service** — NestJS `@GrpcMethod` idiom binds a single class to a proto service (D-03 from 999.11.2).
- `grpc.module.ts` — inbound feature composer. Declares the controller, imports foundation modules the controller needs, binds inbound-port Symbols to application services, and owns the per-service use-cases + outbound persistence per the Plan 10 Option A relocation pattern (see `apps/auth/src/auth.module.ts` canonical comment for authority on this pattern).
- `index.ts` — barrel re-exporting GrpcModule.

Controller responsibilities:

- Injects inbound ports by Symbol token: `@Inject(LOGIN_PORT) private readonly loginService: LoginPort`.
- Owns the proto↔domain mapping. Every method body builds a `Command` from the proto request, awaits the port, projects the domain `Result` back to a proto response. See `references/CALL-FLOW.md` + `references/PROTO-VISIBILITY.md`.
- Allowed imports: `@nestjs/common`, `@nestjs/microservices`, `@email-platform/contracts`, application ports + commands, local constants (Symbol tokens).
- **Forbidden imports:** Drizzle, `domain/entities/*` directly (entities arrive via port results).

### `inbound/rest/{feature}/` (reserved — currently empty everywhere)

Where it would live: `apps/gateway/src/infrastructure/inbound/rest/{feature}/` (or any service hosting a future REST feature endpoint).

Future scaffold for REST-ingress features on the gateway (auth-login endpoint, campaigns API, etc.). No service currently has REST feature endpoints — the gateway is a REST facade but today forwards everything via outbound gRPC. When an auth-login-gateway or campaigns-api-gateway phase lands, it creates e.g. `apps/gateway/src/infrastructure/inbound/rest/auth/auth.controller.ts`. Reserved folder — do not create empty placeholders.

**HealthController is NOT in `inbound/rest/`** — it lives in `bootstrap/health/` per D-08. Rationale: health is framework glue (Ring-4), not a business feature adapter.

### `inbound/rmq/`

Where it lives: `apps/notifier/src/infrastructure/inbound/rmq/`
Canonical files: `event.consumer.ts` + `rmq.module.ts` + `index.ts`.

Only the notifier has RMQ inbound today (D-05 from 999.11.2). Future event consumers feature-slice as `inbound/rmq/{event-type}.consumer.ts` when multiple event patterns exist.

- `event.consumer.ts` — `@EventPattern()` consumer binding an inbound port.
- `rmq.module.ts` — feature composer.
- `index.ts` — barrel.

- Allowed imports: `@nestjs/common`, `@nestjs/microservices` (for `@EventPattern()`), `@email-platform/contracts` (event payload types), application ports + commands, local constants.
- **Forbidden imports:** Drizzle, `domain/entities/*` directly.

---

## Infrastructure / Outbound (`apps/{svc}/src/infrastructure/outbound/`)

Secondary / driven adapters (Cockburn). Implement outbound application ports; translate domain → external system. Feature-sliced per integration: per aggregate (persistence), per upstream service (grpc-clients), per vendor (http-clients), per bucket/namespace (storage), per event type (publishers — future).

Every outbound category with ≥1 sub-slice has a **category-level composer module** (`persistence.module.ts`, `grpc-clients.module.ts`, `http-clients.module.ts`, `storage.module.ts`) that aggregates per-feature sub-modules. The root `{svc}.module.ts` imports the composer, never individual sub-slices.

### `outbound/persistence/{aggregate}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/persistence/{aggregate}/`
Canonical files per aggregate: `{aggregate}.module.ts` + `pg-{aggregate}.repository.ts` + `mappers/{aggregate}.mapper.ts` + `schema/{aggregates}.schema.ts` + `index.ts`.

Present in 4 services: auth (1 aggregate — user), sender (1 — campaign), parser (1 — parser-task), audience (2 — group + recipient).

- `{aggregate}.module.ts` — per-aggregate DynamicModule binding `{AGGREGATE}_REPOSITORY_PORT → Pg{Aggregate}Repository` and importing `PersistenceModule.forRootAsync()` from foundation (makes the `DRIZZLE` token visible to the repository's `@Inject(DRIZZLE)`).
- `pg-{aggregate}.repository.ts` — `implements {Aggregate}RepositoryPort`. Uses Drizzle via `@Inject(DRIZZLE)` from foundation. Delegates row↔entity translation to `{Aggregate}Mapper` (sibling `mappers/` folder).
- `mappers/{aggregate}.mapper.ts` — plain `export const {Aggregate}Mapper = { toDomain(row) {...}, toPersistence(entity) {...} }`. **Const object, not a class.** No `@Injectable()`, no NestJS DI — mappers are pure functions. Infers Drizzle row types via `typeof {aggregates}.$inferSelect` / `$inferInsert`. **Created once a Drizzle row→entity translation exists**; stub repositories (e.g. audience `group/`) may omit `mappers/` until real persistence lands — per-aggregate concern, not a day-one mandate (see `apps/audience/src/infrastructure/outbound/persistence/group/` as the canonical stub shape).
- `schema/{aggregates}.schema.ts` — Drizzle `pgSchema('{service}').table(...)` definitions. `pgSchema` per service provides namespace isolation (`auth`, `sender`, `parser`, `audience`).
- `index.ts` — barrel.

Category composer: `infrastructure/outbound/persistence/persistence.module.ts` imports all per-aggregate modules.

- Repository allowed imports: `@nestjs/common`, `drizzle-orm`, `drizzle-orm/node-postgres`, foundation `DRIZZLE` token, outbound port interfaces, mapper consts, schema consts.
- Repository **forbidden imports:** proto types, `@nestjs/microservices`, `application/services/*`, `application/use-cases/*`.
- Mapper allowed imports: local schema types, `domain/entities/{entity}.entity`.
- Mapper **forbidden imports:** proto types, `@nestjs/*` (including DI decorators), anything from `application/`.
- Schema allowed imports: `drizzle-orm/pg-core` primitives.
- Schema **forbidden imports:** anything from `application/`, `domain/`, proto types, NestJS.

### `outbound/grpc-clients/{upstream}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/grpc-clients/{upstream}/`
Canonical files per upstream: `{upstream}-client.module.ts` + `index.ts`.

Present in 4 services: gateway (5 upstreams — auth, sender, parser, audience, notifier), sender (audience), parser (notifier), audience (parser) = 8 modules total.

- `{upstream}-client.module.ts` — ~22-line module calling `defineGrpcClient<{Upstream}Proto.{Upstream}ServiceClient>({ service: SERVICE.{upstream}, clientToken: SERVICE.{upstream}.diToken })` and re-exporting named tokens (`{UPSTREAM}_CLIENT_GRPC`, `{UPSTREAM}_GRPC_HEALTH`).
- `index.ts` — barrel.

**No per-app client class, no wrapper, no `*-client.constants.ts`** (ESLint Override 7 enforces). Consumer injects `Promisified<{Upstream}Proto.{Upstream}ServiceClient>` directly — see sibling skill `infrastructure-client-layering` §gRPC for the full client-side treatment (Phase 999.7.x reference implementation).

Category composer: `outbound/grpc-clients/grpc-clients.module.ts` imports all per-upstream modules.

- Allowed imports: `@nestjs/common`, foundation gRPC primitives, `@email-platform/config` service catalog, `@email-platform/contracts` proto types (passed as type argument to the factory).
- **Forbidden imports:** local `application/` or `domain/` files (clients are leaf adapters consumed via DI).

### `outbound/http-clients/{vendor}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/http-clients/{vendor}/`

Present in 3 services: sender → cloud-functions (Google Cloud Proxy), parser → appstorespy, notifier → telegram.

Canonical files per vendor: `{vendor}.client.ts` + `{vendor}.module.ts` + `{vendor}-client.constants.ts` + `index.ts`. Notifier telegram additionally has `telegram-notification.adapter.ts` (outbound port adapter implementing `NotificationSenderPort`).

- `{vendor}.client.ts` — client class (may extend `AbstractHttpClient` from foundation — legitimate per `infrastructure-client-layering` skill; HTTP clients are NOT under ESLint Override 6 which targets gRPC).
- `{vendor}.module.ts` — wires the client with env config.
- `{vendor}-client.constants.ts` — local token Symbol (legitimate; Override 7 enumerates gRPC paths only).
- `{vendor}-notification.adapter.ts` (when applicable) — outbound port adapter translating domain → vendor call.
- `index.ts` — barrel.

Category composer: `outbound/http-clients/http-clients.module.ts`.

### `outbound/storage/{bucket-or-namespace}/`

Where it lives: `apps/{svc}/src/infrastructure/outbound/storage/{slice}/`

Present in 2 services: parser + notifier.

- **Parser:** `storage/bucket/` (private parser data) + `storage/reports/` (shared with notifier). Double-module per DC-06 from 999.11.1 — legitimate composition, NOT duplication.
- **Notifier:** `storage/reports/` only (consumes parser-produced reports).

Each slice has `{slice}.module.ts` wiring the per-bucket foundation S3 primitives. Category composer: `outbound/storage/storage.module.ts`.

### `outbound/publishers/{event-type}/` (reserved — Phase 25 EventModule)

Not yet materialised — event publishing is deferred to Phase 25. When introduced, each event type gets its own feature slice under `outbound/publishers/` (e.g. `campaign-completed/`, `recipients-imported/`). Placeholder only — do not create empty folders.

---

## Application Layer (`apps/{svc}/src/application/`)

The orchestration ring. Defines **what** the service does, independent of **how** it's delivered (gRPC) or **where** data comes from (PostgreSQL). Works entirely in domain types.

**Hard rule:** no `@email-platform/contracts` imports, no `@nestjs/microservices` imports — both are enforced by ESLint Override 9.

### `ports/inbound/`

Where it lives: `apps/{svc}/src/application/ports/inbound/{feature}.port.ts`
Canonical file: `login.port.ts` — `export interface LoginPort { execute(cmd: LoginCommand): Promise<LoginResult> }`.

- Pure TypeScript interface — this is OUR contract, not a generated one.
- One port per RPC method: `LoginPort`, `RegisterPort`, `RefreshTokenPort` etc.
- Always shape `execute(cmd: XxxCommand): Promise<XxxResult>` — Command DTO in, Result out.
- `Result` is a sibling interface declared in the same file (or imported from domain types).
- Allowed imports: Command classes, domain types (entities, value objects).
- **Forbidden imports:** proto types, `@nestjs/*` decorators, Drizzle.

### `ports/outbound/`

Where it lives: `apps/{svc}/src/application/ports/outbound/{entity}-repository.port.ts`
Canonical file: `user-repository.port.ts` — `export interface UserRepositoryPort { findByEmail(email): Promise<User | null>; save(user): Promise<void> }`.

- Interface for infrastructure adapters to implement (persistence, external APIs, message publishers).
- Named with `Port` suffix.
- Allowed imports: domain types only.
- **Forbidden imports:** proto types, Drizzle, NestJS, any infrastructure-level type.

### `services/`

Where it lives: `apps/{svc}/src/application/services/{feature}.service.ts`
Canonical file: `login.service.ts` with class `LoginService implements LoginPort`.

- **Composition layer** — implements the inbound port, orchestrates one or more use cases.
- Decorated `@Injectable()` (NestJS DI).
- Injects use cases via constructor parameters (plain class injection, no Symbol token needed — use cases are providers by class reference).
- Per-feature granularity: one service = one inbound port = one RPC method. Never one giant `AuthApplicationService` with all methods.
- Even if today's implementation is pure delegation (`return this.useCase.execute(cmd)`), the layer stays — it's the seam for future cross-cutting (logging, transactions, event emission).
- Allowed imports: `@nestjs/common`, inbound port interface, Command classes, use case classes, domain types.
- **Forbidden imports:** proto types, `@nestjs/microservices`, Drizzle, infrastructure repositories directly.

### `use-cases/`

Where it lives: `apps/{svc}/src/application/use-cases/{operation}.use-case.ts`
Canonical file: `verify-credentials.use-case.ts` with class `VerifyCredentialsUseCase`.

- **Atomic operation** — one business step, reusable across services within the same bounded context.
- Decorated `@Injectable()` (NestJS DI).
- Does NOT `implements` any port (the service does that). Use case is a plain injectable class.
- Injects outbound ports via Symbol tokens: `@Inject(USER_REPOSITORY_PORT) private readonly users: UserRepositoryPort`.
- Signature: `execute(cmd: SomeCommand): Promise<SomeResult>` OR simpler positional arguments for pure internal use cases that a Service composes (e.g., `execute(user: User): Promise<LoginResult>` — when the use case is never a direct inbound port entry).
- Allowed imports: `@nestjs/common`, outbound port interfaces, local constants (Symbol tokens), domain types, Command classes.
- **Forbidden imports:** proto types, `@nestjs/microservices`, Drizzle, infrastructure adapters directly.

### `commands/`

Where it lives: `apps/{svc}/src/application/commands/{feature}.command.ts`
Canonical file: `login.command.ts` with class `LoginCommand`.

- POJO class with `readonly` fields — constructor captures every input.
- Purpose: carry all input arguments for a service/use-case invocation as one named object.
- Scalable: adding a field does not break existing `execute(cmd)` call sites.
- Foundation for future `class-validator` decorators (not added in 999.10 per PROJECT.md "без бизнес-логики").
- Allowed imports: domain types (if a Command field is a VO).
- **Forbidden imports:** proto types, `@nestjs/*`, Drizzle.

---

## Domain Layer (`apps/{svc}/src/domain/`)

The innermost ring. Pure TypeScript. Zero framework dependencies. If you deleted NestJS tomorrow, this folder compiles.

**Hard rule:** no `@nestjs/*`, no `@email-platform/contracts`, no `drizzle-orm`, no `pg*` imports. Enforced by ESLint Override 8.

### `entities/`

Where it lives: `apps/{svc}/src/domain/entities/{entity}.entity.ts`
Canonical file: `user.entity.ts` with class `User`.

- POJO with `readonly` fields and a constructor. No decorators.
- Business invariants belong here as methods (once bodies stop being stubs).
- Allowed imports: other domain types (value objects, domain services).

### `value-objects/` (optional)

Where it lives: `apps/{svc}/src/domain/value-objects/{vo}.vo.ts`
Canonical file: `email.vo.ts` with class `Email`.

- Immutable class with validation in the constructor (throws if invalid).
- Not created in Phase 999.10 per D-19 YAGNI — introduced when real business logic arrives.

### `services/` (optional)

Where it lives: `apps/{svc}/src/domain/services/{name}.ts`
Canonical file: `password-hasher.ts` with class `PasswordHasher`.

- Domain services (stateless business logic that doesn't belong on an entity).
- May be `@Injectable()` ONLY if the service needs NestJS DI (e.g., injecting a `bcrypt` adapter). Otherwise plain class.
- **Exception:** when `@Injectable()` is present, the class must still be framework-agnostic in logic — only DI wiring uses the decorator.
- Not created in Phase 999.10.

### `events/` (optional)

Where it lives: `apps/{svc}/src/domain/events/{event}.event.ts`
Canonical file: `user-registered.event.ts` with class `UserRegisteredEvent`.

- Deferred to Phase 25 (EventModule + RabbitMQ outbound).
- When introduced: plain POJO events emitted by domain methods, projected to RabbitMQ by infrastructure publishers.

---

## Composition Root (`apps/{svc}/src/{svc}.module.ts`)

One flat `@Module` per bounded context. No feature submodules (no `LoginModule` / `RegisterModule`). Since Phase 999.11.2 the root module imports **feature-module composers only** (never individual controllers/providers); feature modules from the three direction sub-bins own their own DI.

Structure (auth — 4 gRPC service shape):

```ts
@Module({
  imports: [
    AuthConfigModule.forRoot(),                // bootstrap/config/ — FIRST (@Global)
    HealthModule,                               // bootstrap/health/
    LoggingModule.forGrpcAsync('auth'),         // foundation
    PersistenceModule,                          // outbound/persistence/ category composer
    GrpcModule,                                 // inbound/grpc/ — declares AuthController
  ],
  // controllers: [] — empty or near-empty (controllers live inside inbound/ composer modules)
  providers: [
    // Zone 1: outbound port bindings (may also live in outbound/persistence/{aggregate}/*.module.ts)
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },

    // Zone 2: inbound port → service bindings (may also live in inbound/grpc/grpc.module.ts)
    { provide: LOGIN_PORT,    useClass: LoginService },
    { provide: REGISTER_PORT, useClass: RegisterService },
    // ... one per RPC method

    // Zone 3: use cases as plain providers (no port binding)
    VerifyCredentialsUseCase,
    IssueTokenPairUseCase,
    PersistUserUseCase,
    // ... as needed
  ],
})
export class AuthModule {}
```

Gateway root differs (no `inbound/`, adds `ThrottleModule` and a single `GrpcClientsModule` for outbound): see `apps/gateway/src/gateway.module.ts`.

---

## DI Tokens (`apps/{svc}/src/{svc}.constants.ts`)

Plain `Symbol('XxxPort')` — **not** `Symbol.for('XxxPort')`. Each service's tokens live in its own `{svc}.constants.ts` file, scoped to that bounded context. Cross-service token sharing is forbidden.

```ts
// apps/auth/src/auth.constants.ts
export const USER_REPOSITORY_PORT = Symbol('UserRepositoryPort');

export const LOGIN_PORT          = Symbol('LoginPort');
export const REGISTER_PORT       = Symbol('RegisterPort');
export const REFRESH_TOKEN_PORT  = Symbol('RefreshTokenPort');
// ... one per RPC method
```

Why `Symbol()` not `Symbol.for()`: per-service scope means no global registry collision risk, and plain `Symbol()` creates a unique-per-declaration token that cannot be fabricated by a consumer who happens to know the string key.

See `.agents/skills/no-magic-values/SKILL.md` for the general rule.

### Gateway exception (D-11a, Phase 999.11.2)

**Gateway has NO root `gateway.constants.ts`** — the file was deleted in Phase 999.11.2 Plan 06 after `GATEWAY_CONFIG` moved to `infrastructure/bootstrap/config/gateway-config.constants.ts` and no cross-folder domain-port Symbols remained (gateway has no application ports today; it is a REST facade forwarding to outbound gRPC). The other 5 services (auth, sender, parser, audience, notifier) retain their root `{svc}.constants.ts` for cross-folder domain-port Symbols consumed by both `infrastructure/inbound/{grpc,rmq}/` adapters and `infrastructure/outbound/persistence/` repositories.

When reading skill references to `{svc}.constants.ts`, mentally substitute "all services except gateway."

---

## Canonical Tree

Hybrid skeleton + per-service variance. The skeleton below is the **3-bin shape** shared by 5 services (auth, audience, sender, parser, notifier). Gateway is a documented 2-bin exception; see §Variance below.

Representative example — auth service (3-bin, 1 aggregate):

```
apps/auth/
├── src/
│   ├── main.ts
│   ├── auth.module.ts
│   ├── auth.constants.ts                                  (cross-folder domain-port Symbols)
│   │
│   ├── infrastructure/
│   │   ├── bootstrap/
│   │   │   ├── config/                                    (4 files + index: constants, env.schema, provider, module)
│   │   │   │   ├── auth-config.constants.ts
│   │   │   │   ├── auth-env.schema.ts
│   │   │   │   ├── auth-config.provider.ts
│   │   │   │   ├── auth-config.module.ts
│   │   │   │   └── index.ts
│   │   │   └── health/
│   │   │       ├── health.module.ts
│   │   │       ├── health.controller.ts
│   │   │       └── index.ts
│   │   ├── inbound/
│   │   │   └── grpc/
│   │   │       ├── grpc.module.ts                         (inbound feature composer)
│   │   │       ├── auth.controller.ts                     (ONE file per proto service — D-03)
│   │   │       └── index.ts
│   │   └── outbound/
│   │       └── persistence/
│   │           ├── persistence.module.ts                  (category composer)
│   │           ├── index.ts
│   │           └── user/                                  (per-aggregate slice)
│   │               ├── user.module.ts
│   │               ├── pg-user.repository.ts
│   │               ├── mappers/
│   │               │   └── user.mapper.ts
│   │               ├── schema/
│   │               │   └── users.schema.ts
│   │               └── index.ts
│   │
│   ├── application/
│   │   ├── ports/
│   │   │   ├── inbound/   {feature}.port.ts               (1 per RPC method)
│   │   │   └── outbound/  user-repository.port.ts
│   │   ├── services/      {feature}.service.ts            (implements inbound port)
│   │   ├── use-cases/     {operation}.use-case.ts         (atomic step)
│   │   └── commands/      {feature}.command.ts            (DTO)
│   │
│   └── domain/
│       ├── entities/                                      user.entity.ts
│       ├── value-objects/                                 (optional — YAGNI per D-19)
│       ├── services/                                      (optional)
│       └── events/                                        (optional — deferred to Phase 25)
│
└── package.json
```

### Variance (per-service deviations from the skeleton)

Verified against the real tree 2026-04-21:

- **Gateway (2-bin exception — D-GATEWAY-02 / D-11a):** no `infrastructure/inbound/` — gateway is a REST facade whose ingress is `infrastructure/bootstrap/throttle/` (rate limit) + downstream outbound `infrastructure/outbound/grpc-clients/` with 5 upstream modules (auth, sender, parser, audience, notifier). **No root `gateway.constants.ts`** (D-11a). Shape: `src/{main.ts, gateway.module.ts, infrastructure/{bootstrap/{config,health,throttle}, outbound/grpc-clients/{auth,sender,parser,audience,notifier}}}`. Note the complete absence of `infrastructure/outbound/persistence/` — gateway has no database.
- **Audience (2 aggregates + 1 upstream):** `infrastructure/outbound/persistence/` has both `group/` (stub repository — NO `mappers/` yet; see `group.module.ts` inline comment) AND `recipient/` (full slice with `mappers/` + `schema/`). Plus `infrastructure/outbound/grpc-clients/parser/` (upstream).
- **Sender (+ 1 upstream, + 1 vendor):** `infrastructure/outbound/persistence/campaign/` + `infrastructure/outbound/grpc-clients/audience/` + `infrastructure/outbound/http-clients/cloud-functions/` (Google Cloud Proxy for email sending).
- **Parser (double storage + 1 upstream + 1 vendor):** `infrastructure/outbound/persistence/parser-task/` + `infrastructure/outbound/grpc-clients/notifier/` + `infrastructure/outbound/http-clients/appstorespy/` + `infrastructure/outbound/storage/{bucket,reports}/` (double-module per DC-06 of 999.11.1 — `bucket/` is private parser data, `reports/` is shared with notifier).
- **Notifier (RMQ inbound + 1 vendor + 1 storage):** `infrastructure/inbound/rmq/` (no `infrastructure/inbound/grpc/` — notifier has no gRPC server) + `infrastructure/outbound/http-clients/telegram/` + `infrastructure/outbound/storage/reports/` (shared with parser). Root `notifier.constants.ts` holds `HANDLE_EVENT_PORT` + `NOTIFICATION_SENDER_PORT`.

Every path in this skeleton + variance list has been `test -f` / `test -d` verified against the real `apps/*/src/` tree per the D-08 verify-against-reality principle.

Sources:
- `.planning/phases/999.10-*/999.10-NOTES.md` §"Target File Structure" (2026-04-18) — original 2-layer shape.
- `.planning/phases/999.11.2-infrastructure-tree-canonical-split/999.11.2-CONTEXT.md` §D-01..D-17 — canonical direction split + feature slicing rules; gateway D-11a exception.
- `.planning/phases/999.11.1-architecture-compliance-audit-and-fix/999.11.1-CONTEXT.md` §D-08..D-12 — Canonical Config Access Contract.

This tree is the canonical source — deviations are violations.
