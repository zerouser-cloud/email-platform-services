# Technology Stack

**Analysis Date:** 2026-04-02

## Languages

**Primary:**
- TypeScript 5.0+ - All application code, NestJS services, gRPC contracts, shared packages

**Secondary:**
- Shell Script - Infrastructure scripts (`packages/contracts/scripts/generate.sh`)
- Protocol Buffers (proto3) - Service contracts and gRPC definitions

## Runtime

**Environment:**
- Node.js 20.0+ (required, see `package.json` engines)
- Running in Docker containers with Node 20-alpine base image (`infra/docker/app.Dockerfile`)

**Package Manager:**
- pnpm 9.0.0 (workspace package manager)
- Lockfile: `pnpm-lock.yaml` (present)
- Workspace: `pnpm-workspace.yaml` (monorepo with 3 shared packages + 6 microservices)

## Frameworks

**Core:**
- NestJS 11.0.1 - Web framework and microservices foundation
  - All 6 services: `@email-platform/gateway`, `@email-platform/auth`, `@email-platform/sender`, `@email-platform/parser`, `@email-platform/audience`, `@email-platform/notifier`
  - Location: Each app has own `apps/*/src/main.ts` entry point
  
- Express.js (via @nestjs/platform-express 11.0.1) - HTTP server foundation

**Framework Extensions:**
- @nestjs/config 4.0.3 - Environment and configuration management
- @nestjs/microservices 11.0.1 - RPC and message queue support
- @nestjs/terminus 11.1.1 - Health check endpoints
- @nestjs/throttler 6.5.0 - Rate limiting (gateway only)
- @nestjs/cli 11.0.0 - Build tooling

**Communication:**
- gRPC over HTTP/2 via @grpc/grpc-js 1.14.3
- Protocol Buffer code generation via @grpc/proto-loader 0.7.15
- ts-proto 2.6.0 - TypeScript code generation from proto files
- grpc-tools 1.12.4 - gRPC service generation

**Logging:**
- nestjs-pino 4.6.0 - Structured logging (Pino wrapper)
- pino 10.3.1 - High-performance JSON logger
- pino-http 11.0.0 - HTTP request logging
- pino-pretty 13.1.3 - Pretty-printed logs for development

**Dependency Injection & Metadata:**
- reflect-metadata 0.2.0 - Decorator and metadata support
- class-validator 0.15.1 - Data validation via decorators
- class-transformer 0.5.1 - Object transformation and serialization
- nestjs-cls 6.2.0 - Request context storage (correlation IDs, user info)

**Security:**
- helmet 8.1.0 - HTTP security headers

**Schema Validation:**
- Zod 4.3.6 - Runtime schema validation (in `@email-platform/config`)

**Reactive:**
- RxJS 7.8.1 - Reactive programming (required by NestJS)

**Protocol Buffers:**
- @bufbuild/protobuf 2.2.3 - Protobuf runtime and code generation

**Health Checks:**
- grpc-health-check 2.1.0 - gRPC health check protocol implementation

## Key Dependencies

**Critical (Used across all services):**
- @email-platform/config - Environment validation and config loading (Zod-based)
- @email-platform/foundation - Shared gRPC clients, logging, error handling, health indicators
- @email-platform/contracts - Protocol buffer definitions and generated TypeScript types

**Build/Compilation:**
- TypeScript 5.0+ - Strict type checking enabled
- ts-node 10.0.0 - Runtime TypeScript execution
- ts-node-dev 2.0.0 - Development watcher

**Infrastructure Clients:**
- PostgreSQL: drizzle-orm 0.45.2 + pg 8.20.0 (integrated via DrizzleModule in packages/foundation)
- Redis client: Not yet integrated (health indicator stub only)
- RabbitMQ client: Not yet integrated (health indicator stub only)
- MinIO client: Not yet integrated (file storage stub only)

## Configuration

**Environment:**
- Loaded via `@email-platform/config` package
- Config schema validation: `packages/config/src/env-schema.ts` (Zod-based)
- Global configuration loader: `packages/config/src/config-loader.ts`
- Entry point: `packages/config/src/index.ts` exports `loadGlobalConfig()`

**Environment Variables Required:**
See `.env.example` and `packages/config/src/infrastructure.ts`:

```
# HTTP Ports
GATEWAY_PORT=3000
AUTH_PORT=3001
SENDER_PORT=3002
PARSER_PORT=3003
AUDIENCE_PORT=3004
NOTIFIER_PORT=3005

# gRPC URLs
AUTH_GRPC_URL=0.0.0.0:50051
SENDER_GRPC_URL=0.0.0.0:50052
PARSER_GRPC_URL=0.0.0.0:50053
AUDIENCE_GRPC_URL=0.0.0.0:50054

# Infrastructure
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/email_platform
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://localhost:5672
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# Cross-Cutting
LOG_LEVEL=info (trace|debug|info|warn|error|fatal)
LOG_FORMAT=pretty (json|pretty)
NODE_ENV=development
CORS_ORIGINS=*

# Resilience
GRPC_DEADLINE_MS=5000
RATE_LIMIT_BURST_TTL=1000
RATE_LIMIT_BURST_LIMIT=10
RATE_LIMIT_SUSTAINED_TTL=60000
RATE_LIMIT_SUSTAINED_LIMIT=100
```

**Build Configuration:**
- `tsconfig.base.json` - Base TypeScript config (strict mode enabled)
- `.eslintrc.js` - ESLint configuration
- `.prettierrc` - Prettier code formatting
- `turbo.json` - Turbo build system configuration

**Service Topology:**
- Defined in `packages/config/src/catalog/services.ts`
- Maps service IDs to ports and gRPC configuration
- Generated at runtime via `packages/config/src/topology.ts`

## Platform Requirements

**Development:**
- Node.js >=20.0.0
- pnpm >=9.0.0
- Docker & Docker Compose (for local infrastructure)

**Production:**
- Node.js 20-alpine (Docker image)
- Environment variables configured via `.env.docker` or deployment platform
- Dockerfile: `infra/docker/app.Dockerfile` (multi-stage build with layer caching)

**Build Outputs:**
- `dist/` directory per app (TypeScript compiled to JavaScript)
- Proto files bundled: `packages/contracts/proto/` copied to Docker image at `/prod/app/proto`

**Infrastructure Targets (defined in docker-compose.yml):**
- PostgreSQL 16
- Redis 7-alpine
- RabbitMQ 3-management
- MinIO (latest)

---

*Stack analysis: 2026-04-02*
