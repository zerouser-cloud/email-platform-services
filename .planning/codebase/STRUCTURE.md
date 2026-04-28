# Codebase Structure

**Analysis Date:** 2026-04-02

## Directory Layout

**Per-service layout reference:** Phase 999.10 established the canonical `Controller → Service → UseCase` layout for the 4 gRPC services (auth, sender, parser, audience). See `.agents/skills/nestjs-hexagonal-mapping/references/LAYERS.md` for layer definitions. Gateway (REST facade) and notifier (RMQ consumer) follow different patterns and are not covered by this canonical tree (deferred per D-13).

```
email-platform/
├── apps/                          # Domain microservices
│   ├── gateway/                   # REST API facade → gRPC router (non-canonical, deferred)
│   │   ├── src/
│   │   │   ├── main.ts           # Bootstrap, NestFactory, middleware setup
│   │   │   ├── gateway.module.ts # DI wiring, imports
│   │   │   ├── health/           # Health check endpoints
│   │   │   ├── infrastructure/   # gRPC clients to upstream services
│   │   │   ├── throttle/         # Rate limiting module
│   │   │   └── test/             # Test/smoke controllers (http + grpc sanity)
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth/                      # Canonical layout (Phase 999.10 reference)
│   │   ├── src/
│   │   │   ├── main.ts                                        # bootstrap
│   │   │   ├── auth.module.ts                                 # composition root (1 flat module)
│   │   │   ├── auth.constants.ts                              # Symbol DI tokens
│   │   │   ├── infrastructure/
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── grpc/
│   │   │   │   │   │   └── auth.controller.ts                 # AuthController implements AuthServiceController
│   │   │   │   │   └── rest/
│   │   │   │   │       └── health.controller.ts               # HealthController @Controller('health')
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── pg-user.repository.ts                  # implements UserRepositoryPort
│   │   │   │   │   ├── mappers/
│   │   │   │   │   │   └── user.mapper.ts                     # row ↔ User entity
│   │   │   │   │   └── schema/
│   │   │   │   │       └── users.schema.ts                    # Drizzle pgSchema
│   │   │   │   └── config/
│   │   │   │       └── auth-env.schema.ts                     # Zod AuthEnvSchema
│   │   │   ├── application/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/                               # LoginPort, RefreshTokenPort, ValidateTokenPort,
│   │   │   │   │   │                                          #   RevokeTokenPort, CreateUserPort, ListUsersPort
│   │   │   │   │   └── outbound/
│   │   │   │   │       └── user-repository.port.ts
│   │   │   │   ├── services/                                  # *Service implements *Port (one per inbound port)
│   │   │   │   │                                              #   login.service.ts, refresh-token.service.ts,
│   │   │   │   │                                              #   validate-token.service.ts, revoke-token.service.ts,
│   │   │   │   │                                              #   create-user.service.ts, list-users.service.ts
│   │   │   │   ├── use-cases/                                 # atomic operations, injected by services
│   │   │   │   │                                              #   verify-credentials.use-case.ts,
│   │   │   │   │                                              #   issue-token-pair.use-case.ts  (shared: login+refresh),
│   │   │   │   │                                              #   validate-refresh-token.use-case.ts,
│   │   │   │   │                                              #   verify-access-token.use-case.ts,
│   │   │   │   │                                              #   revoke-refresh-token.use-case.ts,
│   │   │   │   │                                              #   hash-password.use-case.ts,
│   │   │   │   │                                              #   persist-user.use-case.ts,
│   │   │   │   │                                              #   list-users.use-case.ts
│   │   │   │   └── commands/                                  # POJO DTOs (one per RPC)
│   │   │   │                                                  #   login.command.ts, refresh-token.command.ts,
│   │   │   │                                                  #   validate-token.command.ts, revoke-token.command.ts,
│   │   │   │                                                  #   create-user.command.ts, list-users.command.ts
│   │   │   └── domain/
│   │   │       └── entities/
│   │   │           └── user.entity.ts                         # POJO — zero framework deps
│   │   └── package.json
│   │
│   ├── sender/                    # Canonical layout (Phase 999.10 sweep)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── sender.module.ts
│   │   │   ├── sender.constants.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── grpc/sender.controller.ts
│   │   │   │   │   └── rest/health.controller.ts
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── pg-campaign.repository.ts
│   │   │   │   │   ├── mappers/campaign.mapper.ts
│   │   │   │   │   └── schema/campaigns.schema.ts
│   │   │   │   ├── clients/                                   # gRPC clients to other services
│   │   │   │   │   ├── audience/
│   │   │   │   │   └── cloud-functions/                       # HTTP email-send client
│   │   │   │   └── config/sender-env.schema.ts
│   │   │   ├── application/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/                               # 10 inbound ports: CreateCampaignPort,
│   │   │   │   │   │                                          #   GetCampaignPort, ListCampaignsPort,
│   │   │   │   │   │                                          #   PauseCampaignPort, ResumeCampaignPort,
│   │   │   │   │   │                                          #   CreateMessagePort, ListMessagesPort,
│   │   │   │   │   │                                          #   CreateRunnerPort, ListRunnersPort,
│   │   │   │   │   │                                          #   ListMacrosPort
│   │   │   │   │   └── outbound/campaign-repository.port.ts
│   │   │   │   ├── services/                                  # 10 services (one per inbound port)
│   │   │   │   ├── use-cases/                                 # 9 use cases incl. shared
│   │   │   │   │                                              #   transition-campaign-status.use-case.ts
│   │   │   │   │                                              #   (shared: pause + resume)
│   │   │   │   └── commands/                                  # 10 Command DTOs
│   │   │   ├── domain/
│   │   │   │   └── entities/campaign.entity.ts
│   │   │   └── test/
│   │   │       └── cloudfn-smoke.controller.ts                # D-13 test-boundary exception
│   │   └── package.json
│   │
│   ├── parser/                    # Canonical layout (Phase 999.10 sweep)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── parser.module.ts
│   │   │   ├── parser.constants.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── grpc/parser.controller.ts              # single @ParserServiceControllerMethods() bulk decorator
│   │   │   │   │   └── rest/health.controller.ts
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── pg-parser-task.repository.ts
│   │   │   │   │   ├── mappers/parser-task.mapper.ts
│   │   │   │   │   └── schema/parser-tasks.schema.ts
│   │   │   │   ├── clients/
│   │   │   │   │   ├── appstorespy/                           # external HTTP client
│   │   │   │   │   └── notifier/                              # gRPC client
│   │   │   │   ├── storage/
│   │   │   │   │   ├── parser-storage.module.ts               # private bucket
│   │   │   │   │   └── storage.module.ts                      # public bucket via SharedNamespaceModule
│   │   │   │   └── config/
│   │   │   ├── application/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/                               # 7 ports: CreateTaskPort, GetTaskPort,
│   │   │   │   │   │                                          #   ListTasksPort, GetSettingsPort,
│   │   │   │   │   │                                          #   UpdateSettingsPort, RunStorageSmokePort,
│   │   │   │   │   │                                          #   CleanupStorageSmokePort
│   │   │   │   │   └── outbound/parser-task-repository.port.ts
│   │   │   │   ├── services/                                  # 7 services
│   │   │   │   ├── use-cases/                                 # 8 use cases — smoke cases contain REAL I/O:
│   │   │   │   │                                              #   create-parser-task.use-case.ts (D-23 rename),
│   │   │   │   │                                              #   get-parser-task.use-case.ts,
│   │   │   │   │                                              #   list-parser-tasks.use-case.ts,
│   │   │   │   │                                              #   get-parser-settings.use-case.ts,
│   │   │   │   │                                              #   update-parser-settings.use-case.ts,
│   │   │   │   │                                              #   run-private-smoke-cycle.use-case.ts,
│   │   │   │   │                                              #   run-public-smoke-cycle.use-case.ts,
│   │   │   │   │                                              #   cleanup-smoke-object.use-case.ts
│   │   │   │   └── commands/                                  # 7 Command DTOs
│   │   │   ├── domain/
│   │   │   │   └── entities/parser-task.entity.ts
│   │   │   └── test/
│   │   │       └── appstorespy-smoke.controller.ts            # D-13 test-boundary exception
│   │   └── package.json
│   │
│   ├── audience/                  # Canonical layout (Phase 999.10 sweep)
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── audience.module.ts
│   │   │   ├── audience.constants.ts
│   │   │   ├── infrastructure/
│   │   │   │   ├── controllers/
│   │   │   │   │   ├── grpc/audience.controller.ts
│   │   │   │   │   └── rest/health.controller.ts
│   │   │   │   ├── persistence/
│   │   │   │   │   ├── pg-recipient.repository.ts
│   │   │   │   │   ├── pg-group.repository.ts
│   │   │   │   │   ├── mappers/recipient.mapper.ts
│   │   │   │   │   └── schema/recipients.schema.ts
│   │   │   │   ├── clients/parser/
│   │   │   │   └── config/
│   │   │   ├── application/
│   │   │   │   ├── ports/
│   │   │   │   │   ├── inbound/                               # 8 ports: CreateGroupPort, DeleteGroupPort,
│   │   │   │   │   │                                          #   ListGroupsPort, GetRecipientsByGroupPort,
│   │   │   │   │   │                                          #   ListRecipientsPort, ImportRecipientsPort,
│   │   │   │   │   │                                          #   MarkAsSentPort, ResetSendStatusPort
│   │   │   │   │   └── outbound/
│   │   │   │   │       ├── recipient-repository.port.ts
│   │   │   │   │       └── group-repository.port.ts
│   │   │   │   ├── services/                                  # 8 services
│   │   │   │   ├── use-cases/                                 # 7 use cases incl. shared
│   │   │   │   │                                              #   transition-recipients-status.use-case.ts
│   │   │   │   │                                              #   (shared: mark-as-sent + reset-send-status)
│   │   │   │   └── commands/                                  # 8 Command DTOs
│   │   │   └── domain/
│   │   │       └── entities/                                  # recipient.entity.ts, group.entity.ts
│   │   └── package.json
│   │
│   └── notifier/                  # Async event notifications (non-canonical, deferred)
│       ├── src/
│       │   ├── main.ts
│       │   ├── notifier.module.ts
│       │   ├── notifier.constants.ts
│       │   ├── application/
│       │   ├── domain/
│       │   ├── health/
│       │   ├── infrastructure/   # Telegram HTTP client, S3 clients
│       │   └── test/             # storage-smoke, telegram-smoke
│       └── package.json
│
├── packages/                      # Shared libraries
│   ├── config/                    # Environment & configuration
│   │   ├── src/
│   │   │   ├── index.ts          # Exports
│   │   │   ├── app-config.module.ts # NestJS ConfigModule wrapper
│   │   │   ├── config-loader.ts  # loadGlobalConfig()
│   │   │   ├── env-schema.ts     # Validation schema
│   │   │   ├── env-constants.ts  # Constants (SERVICE, etc)
│   │   │   ├── topology.ts       # gRPC addresses
│   │   │   └── catalog/          # Service registry
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── contracts/                 # gRPC interfaces & events
│   │   ├── proto/                 # Protocol buffer definitions
│   │   │   ├── common.proto       # Shared messages (pagination, health)
│   │   │   ├── auth.proto         # Auth service API
│   │   │   ├── sender.proto       # Sender service API
│   │   │   ├── parser.proto       # Parser service API
│   │   │   ├── audience.proto     # Audience service API
│   │   │   └── scripts/           # Proto generation scripts
│   │   ├── src/
│   │   │   ├── index.ts          # Exports
│   │   │   ├── proto-dir.ts      # Proto file path
│   │   │   └── generated/        # TypeScript from protoc
│   │   │       ├── common.ts
│   │   │       ├── auth.ts       # Generated Auth types & service
│   │   │       ├── sender.ts     # Generated Sender types & service
│   │   │       ├── parser.ts     # Generated Parser types & service
│   │   │       └── audience.ts   # Generated Audience types & service
│   │   ├── generated/            # Direct proto-gen output (may be redundant)
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── foundation/                # NestJS infrastructure utilities
│       ├── src/
│       │   ├── index.ts          # Exports
│       │   ├── constants.ts      # SERVER, CORS constants
│       │   ├── grpc/             # gRPC helpers
│       │   │   ├── server-options.ts # createGrpcServerOptions()
│       │   │   └── clients/      # gRPC client factories
│       │   ├── logging/          # Pino integration
│       │   │   ├── logging.module.ts # LoggingModule.forHttp() / forGrpc()
│       │   │   └── logger.service.ts
│       │   ├── errors/           # Exception handling
│       │   │   └── grpc-to-http-exception.filter.ts
│       │   ├── health/           # Health check
│       │   │   └── health.controller.ts
│       │   └── resilience/       # Retry, circuit breaker (if used)
│       ├── tsconfig.json
│       └── package.json
│
├── infra/                        # Docker & deployment
│   ├── docker/
│   │   └── app.Dockerfile       # Unified Dockerfile for all services
│   ├── docker-compose.yml       # Dev environment orchestration
│   └── nginx/                   # (if Nginx config exists)
│
├── scripts/
│   └── check-architecture.sh    # Architecture boundary validation
│
├── docs/                        # Design documentation
│   ├── ARCHITECTURE_PRESENTATION.md
│   ├── TARGET_ARCHITECTURE.md
│   └── LEGACY_ANALYSIS.md
│
├── .planning/                   # GSD planning output (this location)
│   └── codebase/
│
├── pnpm-workspace.yaml         # Monorepo package declaration
├── turbo.json                  # Build orchestration
├── tsconfig.base.json          # Root TypeScript config
├── package.json                # Workspace root package
├── pnpm-lock.yaml             # Dependency lock
├── .eslintrc.js               # Linting rules
├── .gitignore
└── README.md
```

## Directory Purposes

**`apps/`:**
- Purpose: Self-contained microservices, each with own NestJS app
- Contains: One directory per service (gateway, auth, sender, parser, audience, notifier)
- Key files: `main.ts` (bootstrap), `*.controller.ts` (gRPC handlers), `*.module.ts` (DI)

**`packages/config/`:**
- Purpose: Centralized environment and configuration management
- Contains: Config loader, validation schema, environment constants, service topology
- Key files: `config-loader.ts`, `env-schema.ts`, `app-config.module.ts`

**`packages/contracts/`:**
- Purpose: Service interfaces and shared types (gRPC proto + generated TypeScript)
- Contains: Proto definitions, auto-generated gRPC service types, common messages
- Key files: `proto/*.proto`, `src/generated/*.ts`

**`packages/foundation/`:**
- Purpose: Shared NestJS infrastructure and cross-cutting concerns
- Contains: gRPC utilities, logging, error handling, health checks
- Key files: `grpc/server-options.ts`, `logging/logging.module.ts`, `errors/grpc-to-http-exception.filter.ts`

**`infra/`:**
- Purpose: Deployment and containerization
- Contains: Dockerfile for all services, docker-compose for local dev, Nginx config (if needed)
- Key files: `app.Dockerfile`, `docker-compose.yml`

**`docs/`:**
- Purpose: Architecture and design documentation
- Contains: Architecture diagrams, decisions, legacy analysis

## Key File Locations

**Entry Points:**

| Service   | HTTP Server | gRPC Server | File                       |
|-----------|-------------|-------------|----------------------------|
| Gateway   | :3000       | —           | `apps/gateway/src/main.ts` |
| Auth      | (health)    | :50051      | `apps/auth/src/main.ts`    |
| Sender    | (health)    | :50052      | `apps/sender/src/main.ts`  |
| Parser    | (health)    | :50053      | `apps/parser/src/main.ts`  |
| Audience  | (health)    | :50054      | `apps/audience/src/main.ts`|
| Notifier  | (health)    | —           | `apps/notifier/src/main.ts`|

**DI Wiring & Module Setup:**
- `apps/gateway/src/gateway.module.ts` - Gateway root module
- `apps/auth/src/auth.module.ts` - Auth root module
- `apps/sender/src/sender.module.ts` - Sender root module
- `packages/config/src/app-config.module.ts` - Config provider
- `packages/foundation/src/logging/logging.module.ts` - Logging provider

**gRPC Service Handlers** (Phase 999.10 canonical — `infrastructure/controllers/grpc/`):
- `apps/auth/src/infrastructure/controllers/grpc/auth.controller.ts` — AuthController implements AuthServiceController
- `apps/sender/src/infrastructure/controllers/grpc/sender.controller.ts` — SenderController implements SenderServiceController
- `apps/parser/src/infrastructure/controllers/grpc/parser.controller.ts` — ParserController implements ParserServiceController (single `@ParserServiceControllerMethods()` bulk decorator)
- `apps/audience/src/infrastructure/controllers/grpc/audience.controller.ts` — AudienceController implements AudienceServiceController

**Application layer (Phase 999.10 — Controller → Service → UseCase stack):**
- `apps/{svc}/src/application/services/*.service.ts` — `@Injectable()` composition classes, one per inbound port
- `apps/{svc}/src/application/use-cases/*.use-case.ts` — atomic `@Injectable()` operations, reusable intra-bounded-context
- `apps/{svc}/src/application/ports/inbound/*.port.ts` — our TypeScript interfaces (not generated from proto)
- `apps/{svc}/src/application/ports/outbound/*.port.ts` — interfaces implemented by repository adapters
- `apps/{svc}/src/application/commands/*.command.ts` — POJO Command DTOs, `public readonly` constructor params

**Service Contracts:**
- `packages/contracts/proto/auth.proto` - Auth API definition
- `packages/contracts/proto/sender.proto` - Sender API definition
- `packages/contracts/proto/parser.proto` - Parser API definition
- `packages/contracts/proto/audience.proto` - Audience API definition
- `packages/contracts/proto/common.proto` - Shared types (pagination, health)

**Generated gRPC Types:**
- `packages/contracts/src/generated/auth.ts` - Auth service interface + messages
- `packages/contracts/src/generated/sender.ts` - Sender service interface + messages
- `packages/contracts/src/generated/parser.ts` - Parser service interface + messages
- `packages/contracts/src/generated/audience.ts` - Audience service interface + messages

**Configuration:**
- `packages/config/src/config-loader.ts` - Configuration factory
- `packages/config/src/env-schema.ts` - Joi validation schema
- `packages/config/src/topology.ts` - gRPC service endpoints

**Logging & Error Handling:**
- `packages/foundation/src/logging/logging.module.ts` - Pino integration
- `packages/foundation/src/errors/grpc-to-http-exception.filter.ts` - Error mapper

**Health & Infrastructure:**
- `apps/{auth,sender,parser,audience}/src/infrastructure/controllers/rest/health.controller.ts` — Liveness/readiness probes (Phase 999.10 canonical location)
- `apps/{gateway,notifier}/src/health/health.controller.ts` — Legacy location (deferred per D-13)
- `infra/docker-compose.yml` - Local dev environment

## Naming Conventions

**Files (Phase 999.10 canonical — D-12 one-to-one file↔class):**
- Service root module: `{service}.module.ts` (e.g., `auth.module.ts`) — one flat module per bounded context
- Service constants: `{service}.constants.ts` (Symbol DI tokens)
- gRPC controller: `infrastructure/controllers/grpc/{service}.controller.ts` → class `{Service}Controller` (no `GrpcServer`/`GrpcController` suffix)
- REST health controller: `infrastructure/controllers/rest/health.controller.ts` → class `HealthController`
- Inbound port: `application/ports/inbound/{feature}.port.ts` → interface `{Feature}Port`
- Outbound port: `application/ports/outbound/{entity}-repository.port.ts` → interface `{Entity}RepositoryPort`
- Application service: `application/services/{feature}.service.ts` → class `{Feature}Service implements {Feature}Port`
- Use case: `application/use-cases/{operation}.use-case.ts` → class `{Operation}UseCase` (`@Injectable()`, never implements inbound ports)
- Command DTO: `application/commands/{feature}.command.ts` → class `{Feature}Command` (POJO)
- Repository adapter: `infrastructure/persistence/pg-{entity}.repository.ts` → class `Pg{Entity}Repository implements {Entity}RepositoryPort`
- Mapper: `infrastructure/persistence/mappers/{entity}.mapper.ts` → class `{Entity}Mapper` (toDomain / toPersistence)
- Drizzle schema: `infrastructure/persistence/schema/{entities}.schema.ts`
- Domain entity: `domain/entities/{entity}.entity.ts` → class `{Entity}` (POJO, zero framework deps)
- Bootstrap: `main.ts` (every service)

**Directories:**
- Feature/domain: kebab-case (e.g., `health/`, `throttle/`)
- Layers within service: `domain/`, `application/`, `infrastructure/`
- Proto packages: lowercase (e.g., `auth`, `sender`)
- TypeScript modules: camelCase exported names

**Exports:**
- Path aliases: `@email-platform/config`, `@email-platform/contracts`, `@email-platform/foundation`
- Defined in `tsconfig.base.json` (check `paths` field)

## Where to Add New Code

**New REST Endpoint (Gateway):**
1. Add `.proto` definition to `packages/contracts/proto/{service}.proto` if calling new gRPC service
2. Regenerate: `pnpm proto:generate`
3. Add route handler to `apps/gateway/src/{feature}/` directory
4. Wire in `apps/gateway/src/gateway.module.ts`

**New gRPC Endpoint (canonical Phase 999.10 — auth, sender, parser, audience):**
1. Add RPC method to `packages/contracts/proto/{service}.proto`
2. Run `pnpm proto:generate` to regenerate the TypeScript service interface in `packages/contracts/src/generated/{service}.ts`
3. Author Command DTO: `apps/{service}/src/application/commands/{feature}.command.ts` (POJO class with `public readonly` constructor params)
4. Author inbound port: `apps/{service}/src/application/ports/inbound/{feature}.port.ts` (our interface — not generated)
5. Author service: `apps/{service}/src/application/services/{feature}.service.ts` (`{Feature}Service implements {Feature}Port`)
6. Author use case(s): `apps/{service}/src/application/use-cases/{operation}.use-case.ts` (`@Injectable()`, atomic)
7. Add port method to `infrastructure/controllers/grpc/{service}.controller.ts` — controller still implements the proto interface, maps proto → Command, invokes port, maps result → proto
8. Register Symbol DI token in `apps/{service}/src/{service}.constants.ts` and wire `{ provide: FEATURE_PORT, useClass: FeatureService }` + use cases in `{service}.module.ts`
9. Skill: `.agents/skills/nestjs-hexagonal-mapping/SKILL.md` (8-step decision tree)

**New Shared Library:**
1. Create `packages/{library-name}/src/` directory
2. Add `package.json` with `@email-platform/{library-name}` name
3. Update `pnpm-workspace.yaml` (already includes `packages/*` glob)
4. Import in other packages via `@email-platform/{library-name}`

**New Utility/Service:**
- Shared across services: `packages/foundation/src/{feature}/`
- Service-specific: `apps/{service}/src/infrastructure/{feature}/`

## Special Directories

**`dist/` (Generated):**
- Purpose: Compiled JavaScript output from TypeScript
- Generated: `pnpm build` or `pnpm dev`
- Committed: No

**`node_modules/` (Dependencies):**
- Purpose: Installed npm packages
- Generated: `pnpm install`
- Committed: No

**`generated/` in contracts (Proto Output):**
- Purpose: TypeScript output from protobuf compilation
- Generated: `pnpm proto:generate` (runs protoc-gen-ts_proto)
- Committed: Check .gitignore; likely committed for reproducibility

**`.env.docker` / `.env.development` (Secrets):**
- Purpose: Runtime environment configuration
- Generated: Manual setup (not in repo)
- Committed: No

## Health Check & Liveness Probes

Each service exposes health checks on port 3{N} (e.g., Gateway :3000, Auth :3001, Sender :3002):
- `GET /health/live` - Liveness probe (process is running)
- `GET /health/ready` - Readiness probe (service is ready for traffic)

Implementation:
- **Canonical (Phase 999.10 — auth, sender, parser, audience):** `apps/{service}/src/infrastructure/controllers/rest/health.controller.ts`
- **Legacy (gateway, notifier — deferred per D-13):** `apps/{service}/src/health/health.controller.ts`

## Build & Deployment

**Build artifacts:**
- Location: Each app/package has its own `dist/` directory
- Generated by: `pnpm build` (turborepo parallelizes)

**Docker:**
- Unified `infra/docker/app.Dockerfile` accepts `APP_NAME` build arg
- Service selection: `docker build --build-arg APP_NAME=gateway ...`

**Monorepo orchestration:**
- Tool: Turbo (configured in `turbo.json`)
- Tasks: `build`, `dev`, `lint`, `typecheck`, `start`
- Dependency resolution: Turbo respects `pnpm` workspaces

---

*Structure analysis: 2026-04-02*
