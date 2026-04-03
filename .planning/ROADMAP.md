# Roadmap: Email Platform Foundation Audit

## Overview

This audit hardens the architectural foundation of a 6-service NestJS email platform monorepo. The work follows the dependency graph: shared packages first (contracts, config), then error handling patterns, then service architecture (one reference implementation before replicating), then operational concerns (health, logging, security), and finally full-stack verification. No business logic is implemented -- only structural correctness.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Contract Consolidation** - Single source of truth for generated types, proto pipeline in Turbo
- [ ] **Phase 2: Configuration Management** - One-time config load via DI, environment-aware validation
- [ ] **Phase 3: Error Handling & Safety** - Metadata bug fix, safe error messages, unified error format
- [ ] **Phase 4: Architecture Reference Implementation** - Auth service restructured as Clean/Hexagonal reference
- [ ] **Phase 5: Architecture Replication & Boundaries** - All remaining services follow reference pattern, cross-service isolation enforced
- [ ] **Phase 6: Health & Resilience** - Parallel health checks, tuned retries, liveness/readiness separation
- [ ] **Phase 7: Logging, Security & Operations** - Structured logging, CORS lockdown, graceful shutdown
- [ ] **Phase 8: Verification** - Full-stack smoke test: infra up, services start, health responds, gateway proxies

## Phase Details

### Phase 1: Contract Consolidation
**Goal**: All services import generated types from a single canonical location, and proto generation runs automatically as part of the build pipeline
**Depends on**: Nothing (first phase)
**Requirements**: CONT-01, CONT-02, CONT-03
**Success Criteria** (what must be TRUE):
  1. Only one `generated/` directory exists in the contracts package -- the duplicate is gone
  2. Running `pnpm generate:contracts` from the monorepo root regenerates all proto types
  3. Running `turbo build` triggers proto generation automatically before dependent packages compile
  4. All existing import paths across apps/ and packages/ resolve correctly after consolidation
**Plans:** 1 plan
Plans:
- [x] 01-01-PLAN.md -- Delete duplicate generated dirs, wire Turbo generate task, rename root script

### Phase 2: Configuration Management
**Goal**: Configuration loads once at application bootstrap and is injected via NestJS DI -- no module-scope side effects, no hardcoded secrets
**Depends on**: Phase 1
**Requirements**: CONF-01, CONF-02, CONF-03
**Success Criteria** (what must be TRUE):
  1. Each service calls `loadGlobalConfig()` exactly once (at bootstrap), and all modules receive config through injectable `ConfigService`
  2. Starting a service with `NODE_ENV=production` and `CORS_ORIGINS=*` fails with a clear Zod validation error
  3. MinIO credentials in docker-compose.yml use `${VAR:-default}` substitution, not hardcoded values
**Plans:** 3 plans
Plans:
- [x] 02-01-PLAN.md -- Add async DI variants to LoggingModule and refactor GrpcClientModule
- [x] 02-02-PLAN.md -- Refactor all service modules, ThrottleModule, and HealthController to use ConfigService
- [x] 02-03-PLAN.md -- Zod CORS production validation, docker-compose env substitution, .env.example

### Phase 3: Error Handling & Safety
**Goal**: Errors are safe for clients, structured for debugging, and consistent across all services
**Depends on**: Phase 2
**Requirements**: ERR-01, ERR-02, ERR-03
**Success Criteria** (what must be TRUE):
  1. Logging module handles missing metadata gracefully -- empty metadata array does not crash, falls back to `crypto.randomUUID()`
  2. gRPC error details are logged server-side but never exposed to clients -- clients see generic safe messages
  3. All service error responses follow the shape `{ statusCode, message, error, correlationId }` via a global exception filter
**Plans:** 2 plans
Plans:
- [x] 03-01-PLAN.md -- Fix metadata bug, expand ERROR_MESSAGE, sanitize error messages by gRPC code
- [x] 03-02-PLAN.md -- Inject ClsService, add correlationId to all error responses

### Phase 4: Architecture Reference Implementation
**Goal**: Auth service is restructured into correct Clean/Hexagonal layers (domain/application/infrastructure), serving as the validated reference for all other services
**Depends on**: Phase 3
**Requirements**: ARCH-01
**Success Criteria** (what must be TRUE):
  1. Auth service has `domain/`, `application/`, and `infrastructure/` directories with correct layer separation
  2. Domain layer contains no NestJS imports -- pure TypeScript only
  3. Port interfaces exist in `application/ports/` and adapter implementations in `infrastructure/adapters/`
  4. Architecture-validator agent passes for the auth service without violations
**Plans:** 2 plans
Plans:
- [x] 04-01-PLAN.md -- Domain entity, application ports, and use-case stub (inner layers)
- [x] 04-02-PLAN.md -- Infrastructure adapters and auth.module.ts DI wiring (outer layer)

### Phase 5: Architecture Replication & Boundaries
**Goal**: All remaining services (sender, parser, audience, notifier, gateway) follow the validated reference pattern, with strict isolation between services and correct proto-aligned controller stubs
**Depends on**: Phase 4
**Requirements**: ARCH-02, ARCH-03, CONT-04
**Success Criteria** (what must be TRUE):
  1. Sender, parser, and audience services have Clean/Hexagonal structure matching the auth reference -- architecture-validator passes for each
  2. Notifier is structured as an event-consumer-only service with RabbitMQ health check and no gRPC server
  3. No cross-service imports exist between apps/ -- shared code lives exclusively in packages/
  4. Controller stubs in auth, sender, parser, audience use `@GrpcMethod` decorators matching their proto RPC definitions
**Plans:** 3 plans
Plans:
- [x] 05-01-PLAN.md -- Sender and parser hexagonal scaffolding with gRPC stubs for all proto RPCs
- [x] 05-02-PLAN.md -- Audience hexagonal scaffolding with gRPC stubs, notifier as RabbitMQ event-consumer
- [x] 05-03-PLAN.md -- Gateway infrastructure/clients layer and cross-service boundary verification

### Phase 6: Health & Resilience
**Goal**: Health checking is fast, reliable, and Kubernetes-ready with configurable retry behavior
**Depends on**: Phase 5
**Requirements**: HLTH-01, HLTH-02, HLTH-03
**Success Criteria** (what must be TRUE):
  1. Gateway checks health of all gRPC services in parallel via `Promise.all()`, not sequentially
  2. Retry configuration values are reasonable (not aggressive) and overridable via environment variables
  3. Each service exposes separate liveness (process alive) and readiness (dependencies connected) probe endpoints
**Plans:** 3 plans
Plans:
- [x] 06-01-PLAN.md -- Tune retry defaults, add jitter, env var override
- [x] 06-02-PLAN.md -- Per-service liveness/readiness with correct dependency checks
- [x] 06-03-PLAN.md -- Gateway parallel gRPC health checks via Promise.allSettled

### Phase 7: Logging, Security & Operations
**Goal**: Logs are structured and useful, production security is enforced, and services shut down cleanly
**Depends on**: Phase 6
**Requirements**: LOG-01, LOG-02, SEC-01, OPS-01
**Success Criteria** (what must be TRUE):
  1. Every Pino log entry includes structured fields: service name, environment, and instanceId
  2. A NestJS interceptor logs request/response timing with `{ method, path, statusCode, durationMs }` on every request
  3. `.env.example` contains safe CORS defaults with comments explaining production requirements -- wildcard is rejected at startup in production
  4. Services handle SIGTERM gracefully: in-flight requests complete, gRPC connections drain, DB/RabbitMQ pools close via `enableShutdownHooks()` and `onModuleDestroy`
**Plans:** 2 plans
Plans:
- [x] 07-01-PLAN.md -- Structured log base fields (service, environment, instanceId) and HTTP timing interceptor
- [x] 07-02-PLAN.md -- Graceful shutdown (OnModuleDestroy stubs) and SEC-01 verification

### Phase 8: Verification
**Goal**: The entire platform starts and operates correctly end-to-end -- infrastructure, services, health, and proxying all verified manually
**Depends on**: Phase 7
**Requirements**: VER-01, VER-02, VER-03, VER-04
**Success Criteria** (what must be TRUE):
  1. Running the docker compose command from package.json brings up MongoDB, Redis, RabbitMQ, and MinIO without errors
  2. All 6 services start successfully via their package.json commands with no runtime errors in logs
  3. Curling health endpoints of every service returns correct status responses
  4. Gateway successfully proxies a request to a gRPC service and returns an error in the unified format `{ statusCode, message, error, correlationId }`
**Plans:** TBD
Plans:
- [ ] (to be planned)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Contract Consolidation | 0/1 | Planned | - |
| 2. Configuration Management | 0/TBD | Not started | - |
| 3. Error Handling & Safety | 0/TBD | Not started | - |
| 4. Architecture Reference Implementation | 0/TBD | Not started | - |
| 5. Architecture Replication & Boundaries | 0/TBD | Not started | - |
| 6. Health & Resilience | 0/TBD | Not started | - |
| 7. Logging, Security & Operations | 0/2 | Planned | - |
| 8. Verification | 0/TBD | Not started | - |
