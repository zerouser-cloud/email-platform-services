<!-- GSD:project-start source:PROJECT.md -->
## Project

**Email Platform — Foundation Audit**

Аудит и укрепление фундамента монорепозиторной email-платформы на базе NestJS микросервисов. Платформа состоит из 6 сервисов (gateway, auth, sender, parser, audience, notifier) и 3 shared-пакетов (config, foundation, contracts). Цель — выявить и исправить архитектурные нарушения, баги, нестыковки и размазанность кода, чтобы получить прочную базу для дальнейшей разработки бизнес-логики.

**Core Value:** Каждый сервис должен быть изолированным, с чёткими границами, единым источником истины и правильными контрактами — чтобы бизнес-логика могла строиться на надёжном фундаменте без переделок.

### Constraints

- **Архитектура apps/**: Clean/DDD/Hexagonal — проверяется через architecture-validator агент
- **Архитектура packages/**: Простая утилитарная структура, без DDD
- **Без бизнес-логики**: Только структурный каркас (ports, adapters, use cases) — реализация позже
- **Без тестов**: Тестирование — отдельный следующий этап
- **Tech stack**: NestJS 11, TypeScript, gRPC, PostgreSQL, RabbitMQ, Redis — не меняем
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.0+ - All application code, NestJS services, gRPC contracts, shared packages
- Shell Script - Infrastructure scripts (`packages/contracts/scripts/generate.sh`)
- Protocol Buffers (proto3) - Service contracts and gRPC definitions
## Runtime
- Node.js 20.0+ (required, see `package.json` engines)
- Running in Docker containers with Node 20-alpine base image (`infra/docker/app.Dockerfile`)
- pnpm 9.0.0 (workspace package manager)
- Lockfile: `pnpm-lock.yaml` (present)
- Workspace: `pnpm-workspace.yaml` (monorepo with 3 shared packages + 6 microservices)
## Frameworks
- NestJS 11.0.1 - Web framework and microservices foundation
- Express.js (via @nestjs/platform-express 11.0.1) - HTTP server foundation
- @nestjs/config 4.0.3 - Environment and configuration management
- @nestjs/microservices 11.0.1 - RPC and message queue support
- @nestjs/terminus 11.1.1 - Health check endpoints
- @nestjs/throttler 6.5.0 - Rate limiting (gateway only)
- @nestjs/cli 11.0.0 - Build tooling
- gRPC over HTTP/2 via @grpc/grpc-js 1.14.3
- Protocol Buffer code generation via @grpc/proto-loader 0.7.15
- ts-proto 2.6.0 - TypeScript code generation from proto files
- grpc-tools 1.12.4 - gRPC service generation
- nestjs-pino 4.6.0 - Structured logging (Pino wrapper)
- pino 10.3.1 - High-performance JSON logger
- pino-http 11.0.0 - HTTP request logging
- pino-pretty 13.1.3 - Pretty-printed logs for development
- reflect-metadata 0.2.0 - Decorator and metadata support
- class-validator 0.15.1 - Data validation via decorators
- class-transformer 0.5.1 - Object transformation and serialization
- nestjs-cls 6.2.0 - Request context storage (correlation IDs, user info)
- helmet 8.1.0 - HTTP security headers
- Zod 4.3.6 - Runtime schema validation (in `@email-platform/config`)
- RxJS 7.8.1 - Reactive programming (required by NestJS)
- @bufbuild/protobuf 2.2.3 - Protobuf runtime and code generation
- grpc-health-check 2.1.0 - gRPC health check protocol implementation
## Key Dependencies
- @email-platform/config - Environment validation and config loading (Zod-based)
- @email-platform/foundation - Shared gRPC clients, logging, error handling, health indicators
- @email-platform/contracts - Protocol buffer definitions and generated TypeScript types
- TypeScript 5.0+ - Strict type checking enabled
- ts-node 10.0.0 - Runtime TypeScript execution
- ts-node-dev 2.0.0 - Development watcher
- drizzle-orm 0.45.2 - TypeScript ORM for PostgreSQL (schema-in-code, no codegen)
- pg 8.20.0 - PostgreSQL client driver (connection pool via `pg.Pool`)
- DrizzleModule in packages/foundation - NestJS dynamic module providing DRIZZLE and PG_POOL DI tokens
- PersistenceModule facade - imports DrizzleModule + PostgresHealthModule for service consumption
- pgSchema per service for namespace isolation (auth, sender, parser, audience)
- Repository adapters with toDomain/toPersistence mappers in infrastructure/persistence/
- Redis client: Not yet integrated (health indicator stub only)
- RabbitMQ client: Not yet integrated (health indicator stub only)
- MinIO client: Not yet integrated (file storage stub only)
## Configuration
- Loaded via `@email-platform/config` package
- Config schema validation: `packages/config/src/env-schema.ts` (Zod-based)
- Global configuration loader: `packages/config/src/config-loader.ts`
- Entry point: `packages/config/src/index.ts` exports `loadGlobalConfig()`
# HTTP Ports
# gRPC URLs
# Infrastructure
# Cross-Cutting
# Resilience
- `tsconfig.base.json` - Base TypeScript config (strict mode enabled)
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier code formatting
- `turbo.json` - Turbo build system configuration
- Defined in `packages/config/src/catalog/services.ts`
- Maps service IDs to ports and gRPC configuration
- Generated at runtime via `packages/config/src/topology.ts`
## Platform Requirements
- Node.js >=20.0.0
- pnpm >=9.0.0
- Docker & Docker Compose (for local infrastructure)
- Node.js 20-alpine (Docker image)
- Environment variables configured via `.env.docker` or deployment platform
- Dockerfile: `infra/docker/app.Dockerfile` (multi-stage build with layer caching)
- `dist/` directory per app (TypeScript compiled to JavaScript)
- Proto files bundled: `packages/contracts/proto/` copied to Docker image at `/prod/app/proto`
- PostgreSQL 16
- Redis 7-alpine
- RabbitMQ 3-management
- MinIO (latest)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Controllers: `*.controller.ts` (e.g., `health.controller.ts`, `sender.controller.ts`)
- Modules: `*.module.ts` (e.g., `gateway.module.ts`, `logging.module.ts`)
- Services: `*.service.ts` pattern (not yet used, but NestJS standard)
- Interceptors: `*.interceptor.ts` (e.g., `grpc-logging.interceptor.ts`)
- Filters: `*.filter.ts` (e.g., `rpc-exception.filter.ts`)
- Constants/Config: `*-constants.ts` or `env-constants.ts`
- Types: `types.ts` for type definitions
- Generated code: `generated/` directory contains protobuf-generated code
- Index files: `index.ts` serves as barrel exports for packages
- camelCase for function names
- Descriptive names that indicate purpose: `loadGlobalConfig()`, `resolveProtoPath()`, `checkOverallHealth()`
- Factory functions prefixed with `create`: `createDeadlineInterceptor()`
- Async functions clearly named: `bootstrap()`, methods like `readiness()`, `liveness()`
- Helper functions with clear intent: `checkOverallHealth()`, `resolveTransport()`
- camelCase for variable declarations
- Constant collections use uppercase with underscores: `GRPC_SERVICES`, `LOG_FORMAT`, `LOG_LEVEL`
- Const objects representing configuration use UPPER_SNAKE_CASE: `ERROR_MESSAGE`, `HEADER`, `SERVER`, `CORS`, `HEALTH`
- Private class properties use underscore prefix: `_host`, `_context`
- PascalCase for class names: `GatewayModule`, `HealthController`, `LoggingModule`
- PascalCase for interface names: `GrpcErrorPayload`, `ServiceDeclaration`, `ExecutionContext`
- Type aliases in PascalCase: `LogFormat`, `LogLevel`, `GlobalEnv`
- Discriminator types use readonly properties for immutability: `readonly port: number`
## Code Style
- **No magic values (unnamed literals).** Extract to named `as const` objects in `*-constants.ts`. DI tokens use `Symbol()` (not strings). Allowed: type literals, import paths, 0/1/-1 idioms, log messages, `process.exit(0|1)`. See `.agents/skills/no-magic-values/SKILL.md` for decision tree and patterns.
- **No switch/case, no if/else chains (3+ branches)** for behavior selection. Use Record dispatch, Map + fallback, canHandle chain, or polymorphic classes. Guard clauses and null checks are fine. See `.agents/skills/branching-patterns/SKILL.md` for decision tree and patterns.
- **No environment branching in app code.** Never read `NODE_ENV` or check `isDev`/`isProd`. App consumes config values (LOG_LEVEL, DATABASE_URL), not environment identities. All config through `@email-platform/config`, no direct `process.env`. See `.agents/skills/twelve-factor/SKILL.md` for 12-Factor rules.
- **No infrastructure changes without user approval.** Never change ports, docker-compose, .env files, credentials, or connection strings without explicit confirmation. Standard ports must be preserved (5432, 6379, 5672, 9000). See `.agents/skills/infrastructure-guard/SKILL.md` for pre-change checklist.
- **No defaults or optionals in env schemas.** Zod env schemas must not use `.default()` or `.optional()`. No `z.coerce.boolean()` (use `z.string().transform(v => v === 'true')`). No fallbacks in consumer code (`?? value`, `|| value`). Every env var required, every value from `.env` files. See `.agents/skills/env-schema/SKILL.md` for rules.
- **Infrastructure-client layering.** Identity → catalog (`packages/config`). Mechanisms → foundation (`packages/foundation`). Assembly + naming → apps. Catalog stays transport-agnostic (no `*Token` for grpc/http/rmq). Foundation stays service-agnostic (no `auth`/`sender` references). Single-instance infra (DB/Redis/S3) → token in foundation. Multi-instance with catalog identity (gRPC) → derive token in foundation, name in apps. Multi-instance without catalog (HTTP) → per-app constants. Reference: Phase 999.7.x (gRPC). See `.agents/skills/infrastructure-client-layering/SKILL.md` for decision tree. Tier 1/2/3 framework + layer-name axis convention defined in same skill (Tier 1 = layer-name abstractions, Tier 2 = raw lib instances, Tier 3 = library defaults; see skill for decision tree and rename-test).
- **Runtime smoke verification.** After completing a GSD phase or non-trivial code edits, verify the project starts via `package.json` scripts ONLY — never invent commands like `start:infra:native`. If a needed verification step has no script, ASK the user to add one or grant one-time permission for a concrete command. Test ALL local startup flows the project supports (this project: `pnpm start:native` and `pnpm start:isolated`, with `stop:*`/`reset:*` counterparts). Per flow: stop → build → lint → start → wait for boot → curl `/health/ready` → stop. See `.agents/skills/runtime-smoke-verification/SKILL.md` for the full recipe.
- Prettier configured with:
- Format and check: `pnpm lint:fix` for workspace
- Individual app linting: `eslint src/ --ext .ts`
- ESLint with TypeScript plugin:
- `@typescript-eslint/no-unused-vars`: warn, with underscore exception for intentionally unused params
- `@typescript-eslint/no-explicit-any`: error (strict type safety)
- `@typescript-eslint/explicit-function-return-type`: off (inferred returns allowed)
- `@typescript-eslint/explicit-module-boundary-types`: off
- `@typescript-eslint/no-empty-function`: warn
## Import Organization
- Monorepo uses workspace package references via `@email-platform/{package}` naming
- Package structure: `@email-platform/contracts`, `@email-platform/config`, `@email-platform/foundation`
- Barrel files (`index.ts`) re-export public APIs from each package
- Example: `export * from './constants'` aggregates constants for package consumption
- Each package's `index.ts` exports public API
- Packages export namespaced protos: `export * as AuthProto from './generated/auth'`
- Foundation exports all cross-cutting concerns: logging, error handling, health checks, resilience
## Error Handling
- gRPC services use custom `GrpcException` hierarchy extending `RpcException`
- Standard exceptions:
- Exceptions accept optional `details?: Record<string, unknown>` for context
- All gRPC exceptions caught by `AllRpcExceptionsFilter` in `packages/foundation/src/errors/rpc-exception.filter.ts`
- HTTP exceptions handled by `GrpcToHttpExceptionFilter` in gateway
- Logging includes `stack` for Error objects: `error: errorMessage, stack`
- Catch decorator on filter classes: `@Catch()`
- Filters check exception type before handling
- Unknown errors logged with full stack trace
- Return Observable<never> with throwError for gRPC
## Logging
- HTTP logging configured in `LoggingModule.forHttp()` with:
- gRPC logging configured in `LoggingModule.forGrpc()` with:
- Use `this.logger.info()`, `this.logger.warn()`, `this.logger.error()` from PinoLogger
- Log with structured objects: `this.logger.info({ method, duration, status: 'OK' }, 'message')`
- Correlation ID automatically included in logs via ClsModule
- Child loggers created with context: `PinoLogger.root.child({ correlationId })`
- Log levels: trace, debug, info, warn, error, fatal
- Logging interceptors capture method name, duration, success/error status
- `ClsModule` for correlation ID propagation (globally mounted for HTTP, interceptor-mounted for gRPC)
- Two logging modes: `forHttp()` for REST APIs, `forGrpc()` for microservices
- Transport auto-resolved based on log format: JSON or pretty-printed
## Comments
- Non-obvious business logic requiring explanation
- Architectural decisions or constraints
- Complex algorithms or edge cases
- Migration notes or planned improvements (use TODO/FIXME)
- Used for public API documentation
- Example from `config-loader.ts`:
- Parameters and return types documented for public functions
- Type guards and inline type assertions marked when used
## Function Design
- Most functions are 10-40 lines
- Controllers often single-line method bodies delegating to injected services
- Middleware/interceptors keep business logic minimal
- Complex logic broken into helper functions
- Constructor injection for dependencies (NestJS pattern)
- Method parameters use named objects when more than 2 params: `{ service: string }`
- Arrow functions for callbacks: `({ key, url }) => ...`
- Type parameters for generics in factory functions: `<const Id extends string>`
- NestJS Observable return pattern for interceptors
- Promise returns for async bootstrap and health checks
- Object returns for configurations: `{ code, message, details }`
- Type-safe discriminated unions for service declarations
## Module Design
- Barrel files (`index.ts`) export public API only
- Use `export *` for re-exporting: `export * from './constants'`
- Namespace re-exports for logical grouping: `export * as AuthProto from './generated/auth'`
- Services and utilities exported as named exports
- Private modules/helpers stay internal
- Exports: constants, proto-resolver, grpc-client.module, logging.module, error-messages, health-constants
- Structured as: export * from './category/file'
- Imports consume via: `import { HEALTH } from '@email-platform/foundation'`
- ESLint rules enforce layered architecture in `.eslintrc.js`
- Layer order: contracts (leaf) -> config -> foundation -> apps
- Apps cannot import other apps
- Each layer has no-restricted-imports rules preventing upward references
## Architecture Constraints
- `packages/contracts/`: gRPC proto definitions and generated code
- `packages/config/`: configuration loading, service catalog, environment schema
- `packages/foundation/`: cross-cutting infrastructure (logging, health checks, error handling)
- `apps/{service}/`: microservices (gateway, auth, sender, parser, audience, notifier)
- NestJS modules use static factory methods: `LoggingModule.forHttp()`, `LoggingModule.forGrpc()`
- Dynamic modules return `DynamicModule` with imports, providers, exports
- Global providers registered via `APP_FILTER`, `APP_INTERCEPTOR` tokens
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Multiple NestJS-based domain services communicating via gRPC
- Single REST gateway translating HTTP to gRPC (facade pattern)
- Asynchronous event-driven communication via RabbitMQ
- PostgreSQL for persistence across services
- Dependency Inversion: infrastructure → application → domain
- Proto-based contracts enforce service boundaries
## System Architecture
```
```
## Layers
- Purpose: Framework integrations and external communication
- Location: `apps/*/src/infrastructure/`, `packages/foundation/`
- Contains: gRPC servers/clients, PostgreSQL repositories, RabbitMQ publishers, REST controllers, external API clients
- Depends on: Application, Domain
- Used by: Nothing depends on this layer (inverted)
- Purpose: Business logic orchestration and port definitions
- Location: `apps/*/src/application/`
- Contains: Use case implementations, inbound ports (interfaces), outbound ports (interfaces)
- Depends on: Domain
- Used by: Infrastructure adapters
- Purpose: Pure business logic, zero external dependencies
- Location: `apps/*/src/domain/`
- Contains: Entities, Value Objects, Domain Events, Domain Services
- Depends on: Nothing
- Used by: Application layer
## Data Flow
- **Transactional State:** PostgreSQL (users, campaigns, recipients, parser tasks)
- **Cache:** Redis for temporary session/performance data (if used)
- **Async Coordination:** RabbitMQ events ensure loose coupling between services
- **In-Process:** NestJS providers and modules handle DI
## Key Abstractions
- Purpose: Each microservice is autonomous and specializes in one domain
- Examples: `apps/auth/`, `apps/sender/`, `apps/parser/`, `apps/audience/`, `apps/notifier/`
- Pattern: NestJS module system with gRPC transport (except Gateway which uses REST)
- Purpose: Define boundaries between layers (Inbound for API entry points, Outbound for dependencies)
- Examples: Would be in `apps/*/src/application/ports/` (currently in progress)
- Pattern: TypeScript interfaces describing service contracts
- Purpose: gRPC service definition enforcing type safety between microservices
- Examples: `packages/contracts/proto/auth.proto`, `packages/contracts/proto/sender.proto`
- Pattern: `.proto` files compiled to TypeScript via protoc-gen-ts_proto
- Purpose: Data access abstraction implementing outbound port
- Examples: Repository adapter for each service (PostgreSQL via Drizzle ORM with pgSchema isolation)
- Pattern: Would implement port interfaces, currently implicit in controllers
- Purpose: Asynchronous communication between services
- Examples: `sender.campaign.completed`, `parser.batch.ready`, `recipients.imported`
- Pattern: Published to RabbitMQ topic exchange with routing keys
## Entry Points
- Location: `apps/gateway/src/main.ts`, `apps/gateway/src/gateway.module.ts`
- Triggers: HTTP requests from frontend
- Responsibilities: CORS, validation, helmet, throttling, token validation, gRPC client invocation
- Location: `apps/auth/src/main.ts`, `apps/auth/src/auth.controller.ts`
- Triggers: gRPC calls from Gateway
- Responsibilities: User login, token refresh/validate/revoke, user creation, token signing
- Location: `apps/sender/src/main.ts`, `apps/sender/src/sender.controller.ts`
- Triggers: gRPC calls from Gateway, cron scheduler
- Responsibilities: Campaign CRUD, email sending orchestration, runner management
- Location: `apps/parser/src/main.ts`, `apps/parser/src/parser.controller.ts`
- Triggers: gRPC calls from Gateway, cron scheduler
- Responsibilities: Contact parsing, external API integration, CSV generation
- Location: `apps/audience/src/main.ts`, `apps/audience/src/audience.controller.ts`
- Triggers: gRPC calls from Gateway/Sender, RabbitMQ event subscription
- Responsibilities: Recipient and group management, import/export
- Location: `apps/notifier/src/main.ts`, `apps/notifier/src/notifier.module.ts`
- Triggers: RabbitMQ event consumption (no REST/gRPC)
- Responsibilities: Telegram/email notifications, file delivery
## Error Handling
- `GrpcToHttpExceptionFilter` in `packages/foundation/src/errors/` transforms gRPC errors to HTTP status codes
- Validation errors caught by NestJS `ValidationPipe` and converted to 400 Bad Request
- Domain business logic returns error states via result types (if implemented)
- Uncaught exceptions trigger 500 Internal Server Error
## Cross-Cutting Concerns
- Framework: `nestjs-pino` with `pino` transport
- Configuration: `packages/foundation/src/logging/` - separate config for HTTP vs gRPC
- Example: `LoggingModule.forHttp()` and `LoggingModule.forGrpc()` imported in each service
- NestJS `ValidationPipe` on Gateway for input validation
- Proto message validation at compile time (type safety)
- No additional validation layer visible (should be in domain use cases)
- Gateway requires Bearer token on protected routes
- Calls `AuthService.ValidateToken(gRPC)` to extract UserContext
- UserContext passed via gRPC request context to domain services
- Token format: JWT issued by Auth service, stored by frontend
- Centralized loading via `packages/config/src/config-loader.ts`
- Environment variables validated against schema in `packages/config/src/env-schema.ts`
- `@email-platform/config` package exports `AppConfigModule` and `loadGlobalConfig()`
- Each service imports `AppConfigModule` at module level
## Service Dependencies
- Calls Auth to validate tokens
- Calls Sender/Parser/Audience for domain operations
- No direct database access
- Sender calls `GetRecipientsByGroup()` to fetch email list
- Sender calls `MarkAsSent()` to update recipient status after email sent
- Publishes `sender.campaign.completed`, `sender.email.failed`, `sender.campaign.progress`
- Publishes `parser.batch.ready`, `parser.task.completed`
- Consumes `parser.batch.ready` to import recipients
- Publishes `recipients.imported` when done
- Consumes all event topics: `sender.campaign.completed`, `parser.task.completed`, `email.failed`, `recipients.imported`
- **Parser → AppStoreSpy API:** HTTP GET requests for app/email data
- **Sender → Google Cloud Proxy Functions:** HTTP POST to send emails
- **Notifier → Telegram Bot API:** HTTP POST to send alerts
- **Parser/Notifier → MinIO/S3:** S3-compatible API for file storage
<!-- GSD:architecture-end -->

## NestJS↔Hexagonal Layer Mapping (gRPC microservices — auth, sender, parser, audience)

**Canonical 3-layer server-side stack per Phase 999.10, refined per Phase 999.11.2 into inbound/outbound/bootstrap sub-partitioning. See `.agents/skills/nestjs-hexagonal-mapping/` for the full pattern, anti-patterns, and worked examples. This section is the surface reference; the skill is the source of truth.**

### Direction split inside `infrastructure/` (Phase 999.11.2)

`infrastructure/` partitions into three sub-bins, each reflecting a distinct semantic role:

- **`infrastructure/inbound/`** — primary / driving adapters (Cockburn). Translate external input into application ports. Grouped by transport: `inbound/grpc/{svc}.controller.ts` (one file per proto service per NestJS idiom — `@GrpcMethod` binds a single class to a proto service), `inbound/rest/{feature}/` (gateway feature endpoints), `inbound/rmq/{event}.consumer.ts` (notifier event consumers).
- **`infrastructure/outbound/`** — secondary / driven adapters (Cockburn). Implement outbound ports; translate domain → external. Feature-sliced per integration: `outbound/persistence/{aggregate}/`, `outbound/grpc-clients/{upstream}/`, `outbound/http-clients/{vendor}/`, `outbound/storage/{bucket-or-namespace}/`, `outbound/publishers/{event-type}/`.
- **`infrastructure/bootstrap/`** — Uncle Bob Ring 4 framework glue + Seemann composition-root artifacts. NOT an adapter. Houses: `bootstrap/config/` (Zod env schema + config provider + `{SVC}_CONFIG` Symbol + `@Global() {Svc}ConfigModule`), `bootstrap/health/` (HealthModule wrapping TerminusModule + HealthController), `bootstrap/throttle/` (gateway only — rate-limit module registering APP_GUARD), `bootstrap/logging/` (optional — service-specific logging interceptors).

### File-path reference table

| NestJS Primitive | Hexagonal Layer | Location | Concrete File Example |
|------------------|-----------------|----------|-----------------------|
| `@Controller()` gRPC | Infrastructure (inbound) | `apps/{svc}/src/infrastructure/inbound/grpc/` | `auth.controller.ts` |
| `@Controller()` REST resource | Infrastructure (inbound) | `apps/{svc}/src/infrastructure/inbound/rest/{feature}/` | `gateway/.../auth/auth.controller.ts` (future) |
| `@Controller('health')` REST probe | Infrastructure (bootstrap) | `apps/{svc}/src/infrastructure/bootstrap/health/` | `health.controller.ts` |
| RMQ `@EventPattern()` consumer | Infrastructure (inbound) | `apps/{svc}/src/infrastructure/inbound/rmq/` | `event.consumer.ts` |
| `@Injectable()` Service (inbound port impl) | Application | `apps/{svc}/src/application/services/` | `login.service.ts` |
| `@Injectable()` UseCase (atomic operation) | Application | `apps/{svc}/src/application/use-cases/` | `verify-credentials.use-case.ts` |
| Port interface (inbound) | Application | `apps/{svc}/src/application/ports/inbound/` | `login.port.ts` |
| Port interface (outbound) | Application | `apps/{svc}/src/application/ports/outbound/` | `user-repository.port.ts` |
| Command DTO | Application | `apps/{svc}/src/application/commands/` | `login.command.ts` |
| Entity (POJO) | Domain | `apps/{svc}/src/domain/entities/` | `user.entity.ts` |
| Repository adapter | Infrastructure (outbound) | `apps/{svc}/src/infrastructure/outbound/persistence/{aggregate}/` | `pg-user.repository.ts` |
| Mapper | Infrastructure (outbound) | `apps/{svc}/src/infrastructure/outbound/persistence/{aggregate}/mappers/` | `user.mapper.ts` |
| Upstream gRPC client | Infrastructure (outbound) | `apps/{svc}/src/infrastructure/outbound/grpc-clients/{upstream}/` | `auth-client.module.ts` |
| External HTTP client | Infrastructure (outbound) | `apps/{svc}/src/infrastructure/outbound/http-clients/{vendor}/` | `telegram.client.ts` |
| Storage adapter | Infrastructure (outbound) | `apps/{svc}/src/infrastructure/outbound/storage/{bucket-or-namespace}/` | `bucket.module.ts`, `reports.module.ts` |
| Cache adapter (Redis) | Infrastructure (outbound) | `apps/{svc}/src/infrastructure/outbound/cache/` | `cache.module.ts` (re-exports foundation `CacheModule` — `CACHE_SERVICE` + `CACHE_HEALTH`) |
| Config module + provider + `{SVC}_CONFIG` | Infrastructure (bootstrap) | `apps/{svc}/src/infrastructure/bootstrap/config/` | `auth-config.module.ts`, `auth-config.provider.ts`, `auth-config.constants.ts` |
| HealthModule + HealthController | Infrastructure (bootstrap) | `apps/{svc}/src/infrastructure/bootstrap/health/` | `health.module.ts`, `health.controller.ts` |
| ThrottleModule (gateway) | Infrastructure (bootstrap) | `apps/gateway/src/infrastructure/bootstrap/throttle/` | `throttle.module.ts` |
| Composition root `@Module({})` | Root | `apps/{svc}/src/` | `auth.module.ts` |
| Cross-folder DI tokens (domain ports) | Root | `apps/{svc}/src/` | `auth.constants.ts` (USER_REPOSITORY_PORT, LOGIN_PORT, ...) |

### Field Naming Rules (from Phase 999.10.1 — unchanged)

Dependency-injected field names reflect **runtime identity** — what DI actually binds. Field types retain the `Port` suffix as the architectural contract. DI tokens retain the `_PORT` suffix as architectural artifacts. Grep `_PORT` → full list of ports in a service.

| Layer | Field name | Type | DI token | Runtime class |
|-------|-----------|------|----------|---------------|
| Controller → inbound port | `listGroupsService` | `ListGroupsPort` | `LIST_GROUPS_PORT` | `ListGroupsService` |
| Service → use case | `verifyCredentials` | `VerifyCredentialsUseCase` | — (class ref) | `VerifyCredentialsUseCase` |
| UseCase → outbound port | `userRepository` | `UserRepositoryPort` | `USER_REPOSITORY_PORT` | `PgUserRepository` |

**Domain-role suffixes** (`Repository`, `Factory`, `Policy`, `Sender` — ubiquitous language) ARE mirrored on the field. **Architectural-role suffixes** (`Port`, `Adapter`, `UseCase`, `Boundary` — hexagonal jargon) are NOT. Full treatment: `.agents/skills/nestjs-hexagonal-mapping/references/NAMING.md` §"Field Naming Rules".

### Proto visibility rules (refined paths)

- `@email-platform/contracts` (generated proto types) is imported ONLY in `infrastructure/inbound/grpc/*.controller.ts` (server-side inbound adapter) AND in `infrastructure/outbound/grpc-clients/{upstream}/{upstream}-client.module.ts` + `*-notification.adapter.ts` (client-side outbound adapter). Enforced by ESLint Override 9 in `.eslintrc.js`.
- `@nestjs/microservices` (`GrpcMethod` / `MessagePattern` decorators, `RpcException`) is a transport concern — infrastructure only. Enforced by Override 9.
- `domain/` is pure TypeScript — no `@nestjs/*`, no `@grpc/*`, no proto, no `drizzle-orm`, no `pg`. Enforced by ESLint Override 8.
- Full visibility matrix: `.agents/skills/nestjs-hexagonal-mapping/references/PROTO-VISIBILITY.md`.

### Call flow (canonical)

```
gRPC request → {Service}Controller.method(req)   [infrastructure/inbound/grpc — implements XxxServiceController]
                │ proto → Command DTO (domain types)
                ▼
             → {Feature}Port.execute(cmd)         [application/ports/inbound — our interface]
                ▼
             → {Feature}Service.execute(cmd)      [application/services — implements {Feature}Port]
                │ composition of use cases (seam for logging / transactions / events)
                ▼
             → {Operation}UseCase.execute(...)    [application/use-cases — atomic step]
                │ may call outbound ports
                ▼
             → Pg{Entity}Repository              [infrastructure/outbound/persistence/{aggregate}/]
                ▼
             → Domain Entity (POJO)
```

### Key rules (unchanged)

- **Controller** implements the proto-generated interface. Never implements OUR port.
- **Service** implements OUR inbound port. Never implements the proto interface.
- **UseCase** is `@Injectable()` plain class. NEVER implements any inbound port.
- **Command DTO** is a class (not interface) with `public readonly` constructor params.
- **One flat `@Module({})` per bounded context at root — composes feature modules from all three sub-bins via `imports:`** (refined 999.11.2). No feature submodules above the category level. Shared infrastructure only from foundation (`PersistenceModule` in foundation exposes DRIZZLE; apps build their own category composers).
- **No magic strings for DI tokens** — `Symbol()` in `{svc}.constants.ts` for cross-folder domain-port tokens; per-feature tokens co-located with their feature folder.
- **Field names reflect runtime identity** — `Port` suffix appears on types and DI tokens, never on field names.

### Composition root shape after 999.11.2

Every `{svc}.module.ts` root imports feature modules only (never individual controllers/providers):

```typescript
@Module({
  imports: [
    {Svc}ConfigModule.forRoot(),                     // FIRST — @Global(), bootstrap/config/
    HealthModule,                                     // bootstrap/health/ (D-08 applied in 999.11.2)
    ThrottleModule,                                   // bootstrap/throttle/ — gateway only
    LoggingModule.forGrpcAsync('{svc}'),              // foundation
    PersistenceModule,                                // outbound/persistence/ composer — gRPC services only
    GrpcClientsModule,                                // outbound/grpc-clients/ composer — where applicable
    HttpClientsModule,                                // outbound/http-clients/ composer — where applicable
    StorageModule,                                    // outbound/storage/ composer — parser, notifier
    GrpcModule,                                       // inbound/grpc/ — gRPC services (declares controllers)
    RmqModule,                                        // inbound/rmq/ — notifier only
  ],
  // controllers: [] — empty or near-empty after 999.11.2 (controllers live inside inbound/ composer modules)
  providers: [
    // Domain-port bindings (Zone 1: outbound port → adapter, Zone 2: inbound port → service)
    // MAY also live in the respective feature composers; root keeps them only when necessary for cross-cutting.
    // Zone 3 use-cases stay root-level until a feature-module opts to own them.
  ],
})
```

**Scope:** this mapping covers the four gRPC microservices (auth, sender, parser, audience) + gateway (REST facade with outbound grpc-clients + bootstrap/throttle) + notifier (RMQ consumer with outbound http-clients + storage). Gateway and notifier now share the same infrastructure-tree shape as the gRPC services; the distinction is which inbound adapter (grpc vs rest vs rmq) they host.

**Skill reference:** `.agents/skills/nestjs-hexagonal-mapping/SKILL.md` — full pattern with the decision tree for adding a new RPC method, anti-patterns, and worked examples.

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

**CRITICAL: Before EVERY file-changing action (Edit, Write, Bash with side-effects), run the gsd-flow-guard checkpoint.** See `.agents/skills/gsd-flow-guard/SKILL.md` for the full decision tree.

**Self-check before any edit:**
1. Am I inside a GSD workflow right now? → YES: continue. NO: go to 2.
2. Which `/gsd:*` command handles this? → Route to it. None fits: go to 3.
3. Did the user explicitly authorize a direct edit? → YES: proceed. NO: STOP and ask.

**Routing table:**
- `/gsd:fast` — trivial fixes, status updates, doc tweaks, ROADMAP checkbox flips (< 3 files, no planning needed)
- `/gsd:quick` — medium tasks with GSD guarantees (atomic commits, state tracking)
- `/gsd:debug` — investigation and bug fixing
- `/gsd:execute-phase` — planned phase work
- `/gsd:plan-phase` / `/gsd:insert-phase` — new feature or refactor requiring planning
- `/gsd:docs-update` — project documentation generation

**Common traps (historically violated):**
- "Just update ROADMAP.md" → `/gsd:fast`, not direct Edit
- "Small 2-file refactor" → `/gsd:fast` with atomic commit
- "Found a bug while investigating" → report finding, route to `/gsd:debug` or `/gsd:fast`
- "Phase done, flip the checkbox" → part of phase completion flow

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
