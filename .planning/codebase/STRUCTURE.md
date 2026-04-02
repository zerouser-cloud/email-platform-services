# Codebase Structure

**Analysis Date:** 2026-04-02

## Directory Layout

```
email-platform/
├── apps/                          # Domain microservices
│   ├── gateway/                   # REST API facade → gRPC router
│   │   ├── src/
│   │   │   ├── main.ts           # Bootstrap, NestFactory, middleware setup
│   │   │   ├── gateway.module.ts # DI wiring, imports
│   │   │   ├── health/           # Health check endpoints
│   │   │   └── throttle/         # Rate limiting module
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── auth/                      # User authentication & authorization
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── auth.controller.ts # gRPC handlers
│   │   │   ├── auth.module.ts
│   │   │   └── health/
│   │   └── package.json
│   │
│   ├── sender/                    # Email campaign management
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── sender.controller.ts # gRPC handlers
│   │   │   ├── sender.module.ts
│   │   │   └── health/
│   │   └── package.json
│   │
│   ├── parser/                    # Contact data parsing
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── parser.controller.ts # gRPC handlers
│   │   │   ├── parser.module.ts
│   │   │   └── health/
│   │   └── package.json
│   │
│   ├── audience/                  # Recipients & groups
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── audience.controller.ts # gRPC handlers
│   │   │   ├── audience.module.ts
│   │   │   └── health/
│   │   └── package.json
│   │
│   └── notifier/                  # Async event notifications
│       ├── src/
│       │   ├── main.ts
│       │   ├── notifier.module.ts
│       │   └── health/
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

**gRPC Service Handlers:**
- `apps/gateway/src/gateway.controller.ts` - (if needed for gRPC inbound; currently REST only)
- `apps/auth/src/auth.controller.ts` - Auth service gRPC implementation
- `apps/sender/src/sender.controller.ts` - Sender service gRPC implementation
- `apps/parser/src/parser.controller.ts` - Parser service gRPC implementation
- `apps/audience/src/audience.controller.ts` - Audience service gRPC implementation

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
- `apps/*/src/health/health.controller.ts` - Liveness/readiness probes
- `infra/docker-compose.yml` - Local dev environment

## Naming Conventions

**Files:**
- Service root module: `{service}.module.ts` (e.g., `auth.module.ts`)
- Service controller: `{service}.controller.ts` (e.g., `sender.controller.ts`)
- Bootstrap: `main.ts` (every service)
- Repositories/adapters: `{entity}-{type}.adapter.ts` (to be implemented)
- Domain entities: `{entity}.entity.ts` (to be implemented)
- Use cases: `{operation}.use-case.ts` (to be implemented)

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

**New gRPC Endpoint (Domain Service):**
1. Add RPC method to `packages/contracts/proto/{service}.proto`
2. Run `pnpm proto:generate` to generate TypeScript service interface
3. Implement handler in `apps/{service}/src/{service}.controller.ts` with `@GrpcMethod()` decorator
4. Implement use case in `apps/{service}/src/application/use-cases/` (to be created)
5. Wire use case in `apps/{service}/src/{service}.module.ts`

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

Implementation: `apps/{service}/src/health/health.controller.ts`

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
