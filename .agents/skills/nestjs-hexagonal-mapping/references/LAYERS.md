# Layers

The three Hexagonal layers inside `apps/{svc}/src/` for a gRPC microservice (auth / sender / parser / audience shape). Each subfolder below has a fixed purpose and a fixed list of allowed imports. Violations are caught by ESLint Overrides 8 + 9 (`.eslintrc.js`) and by file-structure review.

Reference Phase: 999.10. Reference service: `apps/auth/` (pilot — Plan 02).

---

## Infrastructure Layer (`apps/{svc}/src/infrastructure/`)

The outermost ring. Talks to the outside world: gRPC server, HTTP server, PostgreSQL, S3, outbound gRPC clients. Implements outbound ports from `application/ports/outbound/`. Uses proto types, NestJS decorators, and Drizzle ORM freely.

### `controllers/grpc/`

Where it lives: `apps/{svc}/src/infrastructure/controllers/grpc/{svc}.controller.ts`
Canonical file: `auth.controller.ts` with class `AuthController`.

- Implements the ts-proto-generated interface: `implements AuthProto.AuthServiceController`.
- Decorated with `@Controller()` and `@AuthProto.AuthServiceControllerMethods()` (in that order — see Pitfall 1 in RESEARCH.md).
- Injects inbound ports by Symbol token: `@Inject(LOGIN_PORT) private readonly loginPort: LoginPort`.
- Owns the proto↔domain mapping. Every method body builds a `Command` from the proto request, awaits the port, projects the domain `Result` back to a proto response.
- Allowed imports: `@nestjs/common`, `@nestjs/microservices`, `@email-platform/contracts`, application ports + commands, local constants (Symbol tokens).
- **Forbidden imports:** Drizzle, `domain/entities/*` directly (entities arrive via port results).

### `controllers/rest/`

Where it lives: `apps/{svc}/src/infrastructure/controllers/rest/health.controller.ts`
Canonical file: `health.controller.ts` with class `HealthController`.

- Standard NestJS REST controller (`@Controller('health')` + `@Get(HEALTH.LIVE)` / `@Get(HEALTH.READY)`).
- Uses `@nestjs/terminus` `HealthCheckService` + service-specific health indicators (`DatabaseHealthIndicator` from foundation, etc.).
- Allowed imports: `@nestjs/common`, `@nestjs/terminus`, foundation health primitives, local constants.
- **Forbidden imports:** proto types, `@nestjs/microservices`.

### `persistence/`

Where it lives: `apps/{svc}/src/infrastructure/persistence/pg-{entity}.repository.ts`
Canonical file: `pg-user.repository.ts` with class `PgUserRepository`.

- Implements an outbound port: `implements UserRepositoryPort`.
- Uses Drizzle via `@Inject(DRIZZLE)` from foundation.
- Delegates row↔entity translation to a `XxxMapper` (sibling `mappers/` folder).
- Allowed imports: `@nestjs/common`, `drizzle-orm`, `drizzle-orm/node-postgres`, foundation DRIZZLE token, outbound port interfaces, mapper consts, schema consts.
- **Forbidden imports:** proto types, `@nestjs/microservices`, `application/services/*`, `application/use-cases/*`.

### `persistence/mappers/`

Where it lives: `apps/{svc}/src/infrastructure/persistence/mappers/{entity}.mapper.ts`
Canonical file: `user.mapper.ts` with const `UserMapper`.

- **Const object, not a class.** Plain `export const UserMapper = { toDomain(row) {...}, toPersistence(entity) {...} }`.
- No `@Injectable()`, no NestJS DI — mappers are pure functions.
- Infers Drizzle row types via `typeof users.$inferSelect` / `$inferInsert`.
- Allowed imports: local schema types, `domain/entities/{entity}.entity`.
- **Forbidden imports:** proto types, `@nestjs/*` (including DI decorators), anything from `application/`.

### `persistence/schema/`

Where it lives: `apps/{svc}/src/infrastructure/persistence/schema/{entities}.schema.ts`
Canonical file: `users.schema.ts` with `pgSchema('auth').table('users', ...)`.

- Drizzle `pgSchema` per service (namespace isolation: `auth`, `sender`, `parser`, `audience`).
- Exports column-typed Drizzle table definitions used by repositories.
- Allowed imports: `drizzle-orm/pg-core` primitives.
- **Forbidden imports:** anything from `application/`, `domain/`, proto types, NestJS.

### `clients/`

Where it lives: `apps/{svc}/src/infrastructure/clients/{upstream}/{upstream}-client.module.ts`
Canonical file: per Phase 999.7.x — `auth-client.module.ts` etc.

- Outbound gRPC clients — this is where the **client-side** skill `infrastructure-client-layering` applies.
- Per that skill: single-arg `defineGrpcClient<TRaw>({ service, clientToken })` + `Promisified<T>` Proxy from foundation.
- Allowed imports: `@nestjs/common`, foundation gRPC primitives, `@email-platform/config` service catalog, `@email-platform/contracts` proto types (passed as type-argument to factory).
- **Forbidden imports:** local `application/` or `domain/` files (clients are leaf adapters consumed via DI).

### `config/`

Where it lives: `apps/{svc}/src/infrastructure/config/{svc}-env.schema.ts`
Canonical file: `auth-env.schema.ts` with Zod `AuthEnvSchema`.

- Zod env schema per service. No defaults, no optionals per `env-schema` skill.
- Extends the global env schema via composition.
- Allowed imports: `zod`, `@email-platform/config` global schema primitives.

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

One flat `@Module` per bounded context. No feature submodules (no `LoginModule` / `RegisterModule`).

Structure:

```ts
@Module({
  imports: [
    AppConfigModule.forRoot(AuthEnvSchema),
    PersistenceModule.forRootAsync(),
    LoggingModule.forGrpcAsync('auth'),
  ],
  controllers: [
    AuthController,    // infrastructure/controllers/grpc/
    HealthController,  // infrastructure/controllers/rest/
  ],
  providers: [
    // Outbound adapters
    { provide: USER_REPOSITORY_PORT, useClass: PgUserRepository },

    // Inbound ports → services
    { provide: LOGIN_PORT,    useClass: LoginService },
    { provide: REGISTER_PORT, useClass: RegisterService },
    // ... one per RPC method

    // Use cases as plain providers (no port binding)
    VerifyCredentialsUseCase,
    IssueTokenPairUseCase,
    PersistUserUseCase,
    // ... as needed
  ],
})
export class AuthModule {}
```

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

---

## Canonical Tree

```
apps/{service}/
├── src/
│   ├── main.ts
│   ├── {service}.module.ts
│   ├── {service}.constants.ts
│   │
│   ├── infrastructure/
│   │   ├── controllers/
│   │   │   ├── grpc/
│   │   │   │   └── {service}.controller.ts
│   │   │   └── rest/
│   │   │       └── health.controller.ts
│   │   ├── persistence/
│   │   │   ├── pg-{entity}.repository.ts
│   │   │   ├── mappers/
│   │   │   │   └── {entity}.mapper.ts
│   │   │   └── schema/
│   │   │       └── {entities}.schema.ts
│   │   ├── clients/
│   │   │   └── {upstream}/
│   │   │       └── {upstream}-client.module.ts
│   │   └── config/
│   │       └── {service}-env.schema.ts
│   │
│   ├── application/
│   │   ├── ports/
│   │   │   ├── inbound/
│   │   │   │   └── {feature}.port.ts
│   │   │   └── outbound/
│   │   │       └── {entity}-repository.port.ts
│   │   ├── services/
│   │   │   └── {feature}.service.ts
│   │   ├── use-cases/
│   │   │   └── {operation}.use-case.ts
│   │   └── commands/
│   │       └── {feature}.command.ts
│   │
│   └── domain/
│       ├── entities/
│       │   └── {entity}.entity.ts
│       ├── value-objects/           (optional — YAGNI per D-19)
│       ├── services/                (optional)
│       └── events/                  (optional — deferred to Phase 25)
│
└── package.json
```

Source: `.planning/phases/999.10-*/999.10-NOTES.md` §"Target File Structure" (2026-04-18). This tree is the canonical source — deviations are violations.
