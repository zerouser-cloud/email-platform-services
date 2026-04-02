# External Integrations

**Analysis Date:** 2026-04-02

## APIs & External Services

**Email Delivery:**
- Configured but not yet implemented - Services expect proxy URLs via Runner configuration
  - Runners accept `proxy_url` parameter in `packages/contracts/proto/sender.proto`
  - Sender service manages runners that deliver emails through proxy services
  - Location: `apps/sender/src/sender.controller.ts`

**Internal gRPC Services:**
- Auth Service (gRPC: port 50051)
  - Provides: Login, Token validation, User management
  - Used by: Gateway (validates requests)
  - Location: `apps/auth/src/auth.controller.ts`
  
- Sender Service (gRPC: port 50052)
  - Provides: Campaign management, Email runners, Messages, Macros
  - Used by: Gateway (campaign endpoints)
  - Location: `apps/sender/src/sender.controller.ts`
  
- Parser Service (gRPC: port 50053)
  - Provides: Email parsing (stub implementation)
  - Used by: Message pipeline
  - Location: `apps/parser/src/parser.controller.ts`
  
- Audience Service (gRPC: port 50054)
  - Provides: Audience/group management (stub implementation)
  - Used by: Sender (for campaign targeting)
  - Location: `apps/audience/src/audience.controller.ts`
  
- Notifier Service (HTTP only, port 3005)
  - Provides: Event notifications (stub implementation)
  - No gRPC endpoint
  - Location: `apps/notifier/src/notifier.controller.ts`

**Service Discovery:**
- No service mesh or consul
- Services discovered via environment variables (hardcoded URLs)
- gRPC URLs passed as env vars: `AUTH_GRPC_URL`, `SENDER_GRPC_URL`, etc.
- See: `packages/config/src/topology.ts`, `packages/config/src/catalog/services.ts`

## Data Storage

**Databases:**
- MongoDB 7
  - Connection: `MONGODB_URI` env var
  - Example: `mongodb://localhost:27017/email-platform`
  - Used by: Auth, Sender, Parser, Audience services
  - Docker Compose: `infra/docker-compose.yml` (mongo:7 service)
  - Client: Not yet integrated (health indicator is stub only)
  - Health check: `packages/foundation/src/health/indicators/mongodb.health.ts` (stub)
  - Schema/Models: Not found in codebase (to be implemented)

**Message Queue:**
- RabbitMQ 3 (AMQP)
  - Connection: `RABBITMQ_URL` env var
  - Example: `amqp://localhost:5672`
  - Used by: Sender, Parser, Audience, Notifier services
  - Docker Compose: `infra/docker-compose.yml` (rabbitmq:3-management service)
  - Client: Not yet integrated (health indicator is stub only)
  - Health check: `packages/foundation/src/health/indicators/rabbitmq.health.ts` (stub)
  - Management UI: Accessible via management plugin
  - Queue declarations: Not found (to be implemented)

**Cache:**
- Redis 7
  - Connection: `REDIS_URL` env var
  - Example: `redis://localhost:6379`
  - Used by: Sender service (rate limiting, session caching)
  - Docker Compose: `infra/docker-compose.yml` (redis:7-alpine service)
  - Client: Not yet integrated (health indicator is stub only)
  - Health check: `packages/foundation/src/health/indicators/redis.health.ts` (stub)
  - Key patterns: Not defined (to be implemented)

**File Storage:**
- MinIO (S3-compatible object storage)
  - Endpoint: `MINIO_ENDPOINT` env var
  - Port: `MINIO_PORT` env var (default: 9000)
  - Access key: `MINIO_ACCESS_KEY` (default: minioadmin)
  - Secret key: `MINIO_SECRET_KEY` (default: minioadmin)
  - Used by: Parser (email content storage), Notifier (attachments)
  - Docker Compose: `infra/docker-compose.yml` (minio/minio service)
  - Console: Accessible on port 9001 in Docker
  - Client: Not yet integrated
  - Bucket patterns: Not defined (to be implemented)

## Authentication & Identity

**Auth Provider:**
- Custom implementation (internal)
  - Location: `apps/auth/src/auth.controller.ts`
  - Token type: JWT (access_token, refresh_token pair)
  - Proto definition: `packages/contracts/proto/auth.proto`
  
**Auth Flow:**
- Login: Email + password -> TokenPair (access + refresh)
- Validation: access_token validated via AuthService.ValidateToken
- Token refresh: refresh_token exchanged for new TokenPair
- Revocation: refresh_token revoked via AuthService.RevokeToken
- User context: Contains user_id, role, organization, team

**Implementation:**
- Auth service stores users and tokens in MongoDB
- Gateway validates every request via Auth service (TODO: gRPC interceptor)
- Request context propagated via nestjs-cls
- See: `packages/foundation/src/logging/grpc-metadata.helper.ts`

**Data Model:**
```
User {
  id: string
  email: string
  role: string
  organization: string
  team: string
  created_at: string
}
```

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, LogRocket, etc.)
- Errors logged to stdout via pino

**Logs:**
- Format: JSON or pretty-printed (configurable via LOG_FORMAT env var)
- Level: Trace, Debug, Info, Warn, Error, Fatal (configurable via LOG_LEVEL env var)
- Transport: Stdout (to be containerized and aggregated externally)
- Request correlation: Via nestjs-cls with correlation ID from headers
  - See: `packages/foundation/src/logging/correlation.interceptor.ts`
- gRPC metadata logging: Extracts and logs gRPC metadata
  - See: `packages/foundation/src/logging/grpc-logging.interceptor.ts`

**Health Checks:**
- HTTP: GET `/health/live` and `/health/ready` endpoints
- gRPC: Standard gRPC health check protocol (grpc-health-check package)
- Indicators implemented as stubs (TODO: real MongoDB, Redis, RabbitMQ checks)
  - MongoDB: `packages/foundation/src/health/indicators/mongodb.health.ts`
  - Redis: `packages/foundation/src/health/indicators/redis.health.ts`
  - RabbitMQ: `packages/foundation/src/health/indicators/rabbitmq.health.ts`
- Docker health checks: Each service defines healthcheck in docker-compose.yml

**Metrics:**
- None detected (no Prometheus, StatsD, etc.)

## CI/CD & Deployment

**Hosting:**
- Docker Compose (local/development)
  - Location: `infra/docker-compose.yml`
  - Includes: 6 services + MongoDB, Redis, RabbitMQ, MinIO
  - Networks: 2 (services, infra)
  - Start: `pnpm docker:up`
  - Stop: `pnpm docker:down`

- Kubernetes-ready (not actively configured, but NestJS health checks support it)

**Build System:**
- Turbo 2.8.14 (monorepo task orchestration)
  - Config: `turbo.json`
  - Build pipeline: contracts -> config -> foundation -> individual apps
  - Task caching: Enabled for build, lint, typecheck; disabled for dev, start

**Build Commands:**
```bash
pnpm build              # Build all apps (via turbo)
pnpm dev                # Dev mode with watch (via turbo)
pnpm start              # Production start
pnpm lint               # Run eslint
pnpm typecheck          # TypeScript validation
pnpm proto:generate     # Generate TypeScript from proto files
```

**Docker Build:**
- Multi-stage Dockerfile: `infra/docker/app.Dockerfile`
  - Stage 1 (Builder): Node 20-alpine, pnpm, TypeScript compilation
  - Stage 2 (Runner): Node 20-alpine, non-root user (appuser:1001)
  - Cache mount: pnpm store for dependency caching
  - Proto files: Copied from build stage to `/prod/app/proto`
  - Build args: `APP_NAME` specifies which service to build

**Deployment Environment Variables:**
- Configured via `.env.docker` for Docker Compose
- Production: Set via deployment platform (K8s secrets, Lambda environment, etc.)
- See: `packages/config/src/env-schema.ts` for all required vars

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, CircleCI config)
- To be implemented

## Environment Configuration

**Required env vars at startup:**
All defined in `packages/config/src/env-schema.ts` and validated with Zod:

**Service Topology:**
- GATEWAY_PORT, AUTH_PORT, SENDER_PORT, PARSER_PORT, AUDIENCE_PORT, NOTIFIER_PORT
- AUTH_GRPC_URL, SENDER_GRPC_URL, PARSER_GRPC_URL, AUDIENCE_GRPC_URL

**Infrastructure:**
- MONGODB_URI
- REDIS_URL
- RABBITMQ_URL
- MINIO_ENDPOINT, MINIO_PORT, MINIO_ACCESS_KEY, MINIO_SECRET_KEY

**Observability:**
- LOG_LEVEL (trace|debug|info|warn|error|fatal)
- LOG_FORMAT (json|pretty)
- NODE_ENV (development|production)
- CORS_ORIGINS (comma-separated list or *)

**Resilience:**
- GRPC_DEADLINE_MS (timeout for gRPC calls)
- RATE_LIMIT_BURST_TTL, RATE_LIMIT_BURST_LIMIT (burst protection)
- RATE_LIMIT_SUSTAINED_TTL, RATE_LIMIT_SUSTAINED_LIMIT (sustained rate limit)

**Optional:**
- PROTO_DIR (path to proto files; defaults to `/app/proto` in Docker)

**Secrets location:**
- Local: `.env` file (not committed)
- Docker: `.env.docker` file (not committed)
- Production: Platform-specific (K8s secrets, AWS Secrets Manager, etc.)

**Config Loading:**
- Centralized in `packages/config/src/config-loader.ts`
- Called at app bootstrap in each service's `main.ts`
- Errors on validation failure (fail-fast pattern)

## Webhooks & Callbacks

**Incoming Webhooks:**
- None detected (email platform receives events, doesn't expose webhooks)

**Outgoing Webhooks/Callbacks:**
- Notifier service (port 3005) intended for event notifications
  - Stub implementation in `apps/notifier/src/notifier.controller.ts`
  - To be implemented: Send notifications on campaign events
  
**Event Flow (Planned):**
1. Sender completes campaign -> emits event to RabbitMQ
2. Notifier service consumes RabbitMQ event
3. Notifier calls external webhook URL (if configured)
4. Or sends notification via email, Slack, etc.

**Integration Points:**
- Runner proxy URLs in Sender service (for email delivery)
- Campaign webhooks (to be implemented)
- Event streaming via RabbitMQ (infrastructure present, not wired)

## Cross-Service Communication

**Service-to-Service (gRPC):**
- Gateway -> Auth (validate tokens)
- Gateway -> Sender (manage campaigns)
- Sender -> Audience (get target groups)
- Parser -> MinIO (store parsed emails)
- Notifier -> Event stream (consume from RabbitMQ)

**Client Library:**
- Implemented in: `packages/foundation/src/grpc/grpc-client.module.ts`
- Server setup: `packages/foundation/src/grpc/grpc-server.factory.ts`
- Proto loader: `packages/foundation/src/grpc/proto-resolver.ts`
- Deadline handling: `packages/foundation/src/resilience/grpc-deadline.interceptor.ts`
- Retry logic: `packages/foundation/src/resilience/retry-connect.ts`

---

*Integration audit: 2026-04-02*
