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
- **Tech stack**: NestJS 11, TypeScript, gRPC, MongoDB, RabbitMQ, Redis — не меняем
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
- MongoDB client: Not yet integrated (health indicator stub only)
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
- MongoDB 7
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
- MongoDB for persistence across services
- Dependency Inversion: infrastructure → application → domain
- Proto-based contracts enforce service boundaries
## System Architecture
```
```
## Layers
- Purpose: Framework integrations and external communication
- Location: `apps/*/src/infrastructure/`, `packages/foundation/`
- Contains: gRPC servers/clients, MongoDB repositories, RabbitMQ publishers, REST controllers, external API clients
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
- **Transactional State:** MongoDB (users, campaigns, recipients, parser tasks)
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
- Examples: MongoRepository for each service (MongoDB collections)
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

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
