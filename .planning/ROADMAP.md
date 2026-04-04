# Roadmap: Email Platform

## Milestones

- **v1.0 Foundation Audit** - Phases 1-8 (shipped 2026-04-04)
- **v2.0 PostgreSQL + Drizzle Migration** - Phases 9-14 (in progress)

## Phases

<details>
<summary>v1.0 Foundation Audit (Phases 1-8) - SHIPPED 2026-04-04</summary>

- [x] **Phase 1: Contract Consolidation** - Single source of truth for generated types, proto pipeline in Turbo
- [x] **Phase 2: Configuration Management** - One-time config load via DI, environment-aware validation
- [x] **Phase 3: Error Handling & Safety** - Metadata bug fix, safe error messages, unified error format
- [x] **Phase 4: Architecture Reference Implementation** - Auth service restructured as Clean/Hexagonal reference
- [x] **Phase 5: Architecture Replication & Boundaries** - All remaining services follow reference pattern, cross-service isolation enforced
- [x] **Phase 6: Health & Resilience** - Parallel health checks, tuned retries, liveness/readiness separation
- [x] **Phase 7: Logging, Security & Operations** - Structured logging, CORS lockdown, graceful shutdown
- [x] **Phase 8: Verification** - Full-stack smoke test: infra up, services start, health responds, gateway proxies

</details>

### v2.0 PostgreSQL + Drizzle Migration (In Progress)

**Milestone Goal:** Replace MongoDB with PostgreSQL + Drizzle ORM across all applicable services while preserving Clean/Hexagonal architecture boundaries.

- [x] **Phase 9: Config & MongoDB Cleanup** - DATABASE_URL in env-schema, purge all MongoDB references from config and code (completed 2026-04-04)
- [x] **Phase 10: Foundation DrizzleModule & Health** - Shared DrizzleModule, DatabaseHealthIndicator DI abstraction, pool lifecycle (completed 2026-04-04)
- [x] **Phase 11: Docker Infrastructure** - PostgreSQL 16 in docker-compose replacing MongoDB, volumes and healthchecks (completed 2026-04-04)
- [x] **Phase 12: Auth Schema & Repository (Reference)** - Drizzle schema, migrations, repository adapter for auth as reference implementation (completed 2026-04-04)
- [x] **Phase 13: Remaining Services Schema & Repository** - Sender, parser, audience schemas, migrations, and repository adapters following auth pattern (completed 2026-04-04)
- [ ] **Phase 14: Verification & Documentation** - All services start, health checks pass, documentation updated

## Phase Details

### Phase 9: Config & MongoDB Cleanup
**Goal**: The platform configuration recognizes PostgreSQL as its database and contains zero traces of MongoDB anywhere in the codebase
**Depends on**: Phase 8 (v1.0 complete)
**Requirements**: INFRA-01, INFRA-03
**Success Criteria** (what must be TRUE):
  1. `DATABASE_URL` exists in env-schema.ts with Zod validation (connection string format), and `MONGO_URI`/`MONGODB_URI` is removed
  2. `grep -ri mongo` across the entire codebase returns zero matches (excluding git history and node_modules)
  3. All 6 services start successfully after config changes (no runtime errors from removed env vars)
**Plans**: 1 plan
Plans:
- [x] 09-01-PLAN.md — Purge MongoDB references, replace MONGODB_URI with DATABASE_URL

### Phase 10: Foundation DrizzleModule & Health
**Goal**: Any service can import a shared DrizzleModule to get a configured Drizzle instance and database health checking via DI, with proper connection pool lifecycle
**Depends on**: Phase 9
**Requirements**: FOUND-01, FOUND-02, FOUND-03
**Success Criteria** (what must be TRUE):
  1. `DrizzleModule.forRootAsync()` is available in packages/foundation, providing `DRIZZLE` and `PG_POOL` injection tokens via NestJS DI
  2. A `DatabaseHealthIndicator` DI token is provided -- concrete `PostgresHealthIndicator` is registered in the module, consumers inject the abstraction (controller never references PostgreSQL directly)
  3. Pool shuts down cleanly on application shutdown (`OnApplicationShutdown` calls `pool.end()`), verified by observing no connection leak warnings
  4. All 6 services start successfully (gateway and notifier do not import DrizzleModule but are unaffected)
**Plans**: 1 plan
Plans:
- [x] 10-01-PLAN.md — DrizzleModule, PostgresHealthModule, PersistenceModule facade, dependencies, barrel exports

### Phase 11: Docker Infrastructure
**Goal**: Local development infrastructure runs PostgreSQL instead of MongoDB, with all services able to connect
**Depends on**: Phase 10
**Requirements**: INFRA-02
**Success Criteria** (what must be TRUE):
  1. `docker-compose up` starts PostgreSQL 16 with a healthcheck, persistent volume, and correct credentials matching `DATABASE_URL`
  2. MongoDB service is fully removed from docker-compose (no mongo container, no mongo volume)
  3. All 6 services start and health checks pass with the new Docker infrastructure
**Plans**: 1 plan
Plans:
- [x] 11-01-PLAN.md — Replace MongoDB with PostgreSQL in docker-compose, update env files

### Phase 12: Auth Schema & Repository (Reference)
**Goal**: Auth service has a complete Drizzle persistence layer (schema, migrations, repository adapter) that serves as the validated reference pattern for all other services
**Depends on**: Phase 11
**Requirements**: SCHM-01, SCHM-02, SCHM-03, REPO-01
**Success Criteria** (what must be TRUE):
  1. Auth service has a Drizzle schema using `pgSchema('auth')` for namespace isolation, with table definitions in `infrastructure/persistence/schema/`
  2. `drizzle-kit generate` produces a migration file, and `drizzle-kit migrate` applies it successfully against running PostgreSQL
  3. `PgUserRepository` implements the existing `UserRepositoryPort` interface using Drizzle queries, with explicit `toDomain()`/`toPersistence()` mappers
  4. No Drizzle types (`InferSelectModel`, `pgTable`, etc.) appear outside `infrastructure/` -- domain and application layers remain pure
  5. All 6 services start and health checks pass after auth schema and repository changes
**Plans**: 1 plan
Plans:
- [x] 12-01-PLAN.md — Auth Drizzle schema, migrations, repository adapter

### Phase 13: Remaining Services Schema & Repository
**Goal**: Sender, parser, and audience services each have their own Drizzle persistence layer following the auth reference pattern
**Depends on**: Phase 12
**Requirements**: REPO-02, REPO-03
**Success Criteria** (what must be TRUE):
  1. Each service (sender, parser, audience) has its own `pgSchema` with table definitions in `infrastructure/persistence/schema/`
  2. Each service has a `drizzle.config.ts` scoped to its own schema, and `drizzle-kit generate`/`migrate` works independently per service
  3. Repository adapters implement existing port interfaces using Drizzle queries, with `toDomain()`/`toPersistence()` mappers that keep Drizzle types in infrastructure
  4. All 6 services start and health checks pass after all repository adapters are wired
**Plans**: 1 plan
Plans:
- [x] 13-01-PLAN.md — Sender, parser, audience Drizzle schemas, migrations, repository adapters

### Phase 14: Verification & Documentation
**Goal**: The entire platform operates correctly with PostgreSQL, and all documentation reflects the new tech stack
**Depends on**: Phase 13
**Requirements**: VRFY-01, VRFY-02
**Success Criteria** (what must be TRUE):
  1. `docker-compose up` followed by starting all 6 services produces zero errors -- every service starts and every health check endpoint returns healthy
  2. CLAUDE.md tech stack section references PostgreSQL + Drizzle ORM (not MongoDB), with correct versions and patterns
  3. All drizzle-kit migrations apply cleanly on a fresh database (drop and recreate scenario)
  4. Gateway proxies a request to a gRPC service and returns the expected response format
**Plans**: 1 plan
Plans:
- [ ] 14-01-PLAN.md — Full-stack verification, CLAUDE.md update

## Progress

**Execution Order:**
Phases execute in numeric order: 9 -> 10 -> 11 -> 12 -> 13 -> 14

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Contract Consolidation | v1.0 | 1/1 | Complete | 2026-04-04 |
| 2. Configuration Management | v1.0 | 3/3 | Complete | 2026-04-04 |
| 3. Error Handling & Safety | v1.0 | 2/2 | Complete | 2026-04-04 |
| 4. Architecture Reference Implementation | v1.0 | 2/2 | Complete | 2026-04-04 |
| 5. Architecture Replication & Boundaries | v1.0 | 3/3 | Complete | 2026-04-04 |
| 6. Health & Resilience | v1.0 | 3/3 | Complete | 2026-04-04 |
| 7. Logging, Security & Operations | v1.0 | 2/2 | Complete | 2026-04-04 |
| 8. Verification | v1.0 | 2/2 | Complete | 2026-04-04 |
| 9. Config & MongoDB Cleanup | v2.0 | 1/1 | Complete   | 2026-04-04 |
| 10. Foundation DrizzleModule & Health | v2.0 | 1/1 | Complete   | 2026-04-04 |
| 11. Docker Infrastructure | v2.0 | 1/1 | Complete   | 2026-04-04 |
| 12. Auth Schema & Repository (Reference) | v2.0 | 1/1 | Complete | 2026-04-04 |
| 13. Remaining Services Schema & Repository | v2.0 | 1/1 | Complete | 2026-04-04 |
| 14. Verification & Documentation | v2.0 | 0/TBD | Not started | - |
