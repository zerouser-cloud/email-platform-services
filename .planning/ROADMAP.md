# Roadmap: Email Platform

## Milestones

- v1.0 Foundation Audit - Phases 1-8 (shipped 2026-04-04)
- v2.0 PostgreSQL + Drizzle Migration - Phases 9-14 (shipped 2026-04-04)
- v3.0 Infrastructure & CI/CD - Phases 15-19 (in progress)

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

<details>
<summary>v2.0 PostgreSQL + Drizzle Migration (Phases 9-14) - SHIPPED 2026-04-04</summary>

- [x] **Phase 9: Config & MongoDB Cleanup** - DATABASE_URL in env-schema, purge all MongoDB references from config and code
- [x] **Phase 10: Foundation DrizzleModule & Health** - Shared DrizzleModule, DatabaseHealthIndicator DI abstraction, pool lifecycle
- [x] **Phase 11: Docker Infrastructure** - PostgreSQL 16 in docker-compose replacing MongoDB, volumes and healthchecks
- [x] **Phase 12: Auth Schema & Repository (Reference)** - Drizzle schema, migrations, repository adapter for auth as reference implementation
- [x] **Phase 13: Remaining Services Schema & Repository** - Sender, parser, audience schemas, migrations, and repository adapters following auth pattern
- [x] **Phase 14: Verification & Documentation** - All services start, health checks pass, documentation updated

</details>

### v3.0 Infrastructure & CI/CD (In Progress)

**Milestone Goal:** Establish proper dev/docker/production workflows with CI/CD pipeline, following 12-Factor principles.

- [x] **Phase 15: Docker Compose Split & Environment** - Separate infra/services compose files, fix ports, sync env files (completed 2026-04-04)
- [x] **Phase 16: CI Pipeline** - GitHub Actions PR validation with Turbo affected-only execution and remote cache (completed 2026-04-04)
- [ ] **Phase 17: Docker Image Build & Push** - Per-service Docker builds via matrix strategy, published to GHCR with scoped cache
- [ ] **Phase 18: Deployment** - SSH deploy to VPS with Caddy reverse proxy and health verification
- [ ] **Phase 19: Verification** - Both dev modes work, CI pipeline passes on clean repo

## Phase Details

### Phase 15: Docker Compose Split & Environment
**Goal**: Developers have two working development modes -- local dev (infra in Docker, services on host) and full Docker -- with correct environment configuration and no unauthorized port overrides
**Depends on**: Phase 14 (v2.0 complete)
**Requirements**: DOCK-01, DOCK-02, DOCK-03, DOCK-04
**Success Criteria** (what must be TRUE):
  1. Docker Compose is split into at least two files (infra-only and full-stack) using `include` or profiles, and `docker compose config` validates each without errors
  2. Running `docker compose -f docker-compose.infra.yml up` exposes PostgreSQL (5432), Redis (6379), RabbitMQ (5672/15672), and MinIO (9000/9001) on the host for local dev
  3. POSTGRES_PORT variable is removed -- PostgreSQL uses standard port 5432 hardcoded in docker-compose, matching DATABASE_URL
  4. `.env`, `.env.docker`, and `.env.example` contain the same set of keys (values may differ), and `.env.example` is the tracked source of truth
  5. All 6 services start successfully under both development modes (host-run and full Docker)
**Plans**: 1 plan
Plans:
- [x] 15-01-PLAN.md -- Compose split, env sync, NODE_ENV removal, CORS fix, verification

### Phase 16: CI Pipeline
**Goal**: Every pull request is automatically validated for lint, typecheck, and build correctness, with fast feedback via Turbo caching
**Depends on**: Phase 15
**Requirements**: CI-01, CI-02, CI-03
**Success Criteria** (what must be TRUE):
  1. A GitHub Actions workflow triggers on every PR to main, running lint + typecheck + build steps
  2. Turbo executes only affected packages (changed since base branch), not the entire monorepo
  3. Turbo remote cache is configured via GitHub Actions cache backend -- second runs of unchanged packages hit cache and skip execution
  4. CI completes successfully on a clean clone of the repository with no manual setup required
**Plans**: 1 plan
Plans:
- [x] 16-01-PLAN.md -- CI workflow, turbo.json fix, Husky hooks, branch protection script

### Phase 16.1: Docker Port Isolation (INSERTED)
**Goal**: В full Docker режиме наружу доступен только gateway (порт 4000). Инфраструктурные порты убраны из docker-compose.infra.yml в отдельный dev-ports override. Три файла: infra (без портов), dev-ports (override с портами для local dev), docker-compose.yml (full stack, только gateway наружу).
**Depends on**: Phase 16
**Requirements**: DOCK-01 (refinement)
**Success Criteria** (what must be TRUE):
  1. `docker-compose.infra.yml` defines infra services WITHOUT `ports:` — only internal networking
  2. `docker-compose.dev-ports.yml` override file adds host port exposure for local dev (5432, 6379, 5672, 15672, 9000, 9001)
  3. `docker-compose.yml` (full stack) includes infra without ports — only gateway exposes port 4000 to host
  4. Local dev mode works: `docker compose -f infra/docker-compose.infra.yml -f infra/docker-compose.dev-ports.yml up` exposes infra ports
  5. Full Docker mode works: `docker compose -f infra/docker-compose.yml up` exposes only gateway:4000
  6. App code unchanged — no env branching, same DATABASE_URL/REDIS_URL consumed from config
**Plans**: 1 plan

Plans:
- [ ] 16.1-01-PLAN.md -- Remove infra ports, create dev-ports override, update scripts

### Phase 17: Docker Image Build & Push
**Goal**: Docker images for each service are automatically built and published to GHCR when changes merge to main
**Depends on**: Phase 16
**Requirements**: DBLD-01, DBLD-02, DBLD-03
**Success Criteria** (what must be TRUE):
  1. A GitHub Actions workflow builds Docker images for each service in parallel using matrix strategy
  2. Built images are pushed to GHCR (`ghcr.io/<org>/email-platform-<service>`) with SHA and latest tags
  3. Docker layer cache is scoped per service (no cross-service cache eviction), and rebuilds of unchanged layers are cache hits
  4. `docker pull` of a published image and `docker run` starts the service without errors
**Plans**: TBD

### Phase 18: Deployment
**Goal**: Merged changes are deployed to a VPS with HTTPS access and verified health
**Depends on**: Phase 17
**Requirements**: DPLY-01, DPLY-02, DPLY-03
**Success Criteria** (what must be TRUE):
  1. A deploy workflow SSHs into the VPS, pulls updated images from GHCR, and runs `docker compose up -d` with the production compose file
  2. Caddy reverse proxy is configured with automatic TLS, routing HTTPS traffic to the gateway service
  3. After deployment completes, health check endpoints return healthy status for all running services
  4. The deploy workflow fails visibly (non-zero exit) if health checks do not pass within a timeout
**Plans**: TBD
**NOTE**: This phase requires VPS connection details (SSH host, user, key) and domain name as user input before planning.

### Phase 19: Verification
**Goal**: Both development workflows and the CI pipeline are validated end-to-end on a clean state
**Depends on**: Phase 18
**Requirements**: VRFY-01, VRFY-02
**Success Criteria** (what must be TRUE):
  1. Local dev mode works: `docker compose -f docker-compose.infra.yml up` starts infrastructure, then services run on the host and connect successfully
  2. Full Docker mode works: `docker compose up` starts both infrastructure and all services, with inter-service gRPC communication functioning
  3. Pushing a PR to GitHub triggers CI, which passes lint + typecheck + build without manual intervention
  4. No regressions from v1.0/v2.0 -- all 6 services start, health checks pass, gateway proxies requests correctly
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 15 -> 16 -> 17 -> 18 -> 19

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
| 9. Config & MongoDB Cleanup | v2.0 | 1/1 | Complete | 2026-04-04 |
| 10. Foundation DrizzleModule & Health | v2.0 | 1/1 | Complete | 2026-04-04 |
| 11. Docker Infrastructure | v2.0 | 1/1 | Complete | 2026-04-04 |
| 12. Auth Schema & Repository (Reference) | v2.0 | 1/1 | Complete | 2026-04-04 |
| 13. Remaining Services Schema & Repository | v2.0 | 1/1 | Complete | 2026-04-04 |
| 14. Verification & Documentation | v2.0 | 1/1 | Complete | 2026-04-04 |
| 15. Docker Compose Split & Environment | v3.0 | 1/1 | Complete   | 2026-04-04 |
| 16. CI Pipeline | v3.0 | 1/1 | Complete    | 2026-04-04 |
| 16.1. Docker Port Isolation | v3.0 | 0/1 | Planning | - |
| 17. Docker Image Build & Push | v3.0 | 0/? | Not started | - |
| 18. Deployment | v3.0 | 0/? | Not started | - |
| 19. Verification | v3.0 | 0/? | Not started | - |
