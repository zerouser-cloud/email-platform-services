# Requirements: Email Platform

**Defined:** 2026-04-04
**Core Value:** Each service isolated with clear boundaries, single source of truth, and correct contracts -- reliable foundation for business logic

## v3.0 Requirements

Requirements for Infrastructure & CI/CD. Each maps to roadmap phases.

### Docker Compose & Environment

- [x] **DOCK-01**: Docker Compose split into infra and services via `include` or profiles
- [x] **DOCK-02**: Infrastructure ports exposed for local dev (5432, 6379, 5672, 9000)
- [x] **DOCK-03**: POSTGRES_PORT variable reverted -- standard 5432 in docker-compose
- [x] **DOCK-04**: Env files synchronized (.env, .env.docker, .env.example) -- same set of keys

### CI Pipeline

- [x] **CI-01**: GitHub Actions workflow: lint + typecheck + build on every PR
- [x] **CI-02**: Turbo affected-only execution -- CI runs only changed packages
- [x] **CI-03**: Turbo remote cache via GitHub Actions cache

### Docker Build

- [x] **DBLD-01**: Docker image build per service via matrix strategy in GitHub Actions
- [x] **DBLD-02**: Images published to GHCR (GitHub Container Registry)
- [x] **DBLD-03**: Scoped Docker layer cache per service

### Deployment (via Coolify)

- [x] **DPLY-01**: Coolify environments (dev + prod) with infrastructure: PostgreSQL, Redis (native DBs), RabbitMQ, Garage (one-click Services). GitHub repo connected, auto-deploy on push to dev/main
- [ ] **DPLY-02**: Traefik (via Coolify) routes dev.email-platform.pp.ua and email-platform.pp.ua to respective gateway services with auto-TLS
- [x] **DPLY-03**: Health check verification after deploy — /health/ready returns all services SERVING
- [x] **DPLY-04**: MINIO_* env vars renamed to S3_* (storage-agnostic) in schema, .env files, and Coolify config

### Verification

- [x] **VRFY-01**: Both dev modes work: local dev (infra in Docker) + full Docker
- [ ] **VRFY-02**: CI pipeline passes on clean repo

## v2.0 Requirements (Validated)

- [x] **INFRA-01**: DATABASE_URL in env-schema with Zod validation -- Phase 9
- [x] **INFRA-02**: PostgreSQL 16 in docker-compose -- Phase 11
- [x] **INFRA-03**: All MongoDB references removed -- Phase 9
- [x] **FOUND-01**: DrizzleModule in packages/foundation -- Phase 10
- [x] **FOUND-02**: DatabaseHealthIndicator DI abstraction -- Phase 10
- [x] **FOUND-03**: Pool lifecycle graceful shutdown -- Phase 10
- [x] **SCHM-01**: pgSchema per service -- Phase 12
- [x] **SCHM-02**: drizzle-kit config and migrations -- Phase 12
- [x] **SCHM-03**: Drizzle types not in domain layer -- Phase 12
- [x] **REPO-01**: Auth repository adapter -- Phase 12
- [x] **REPO-02**: Sender, Parser, Audience adapters -- Phase 13
- [x] **REPO-03**: Mappers keep types in infrastructure -- Phase 13
- [x] **VRFY-01**: All services start, health checks -- Phase 14
- [x] **VRFY-02**: Documentation updated -- Phase 14

## v1.0 Requirements (Validated)

- [x] **ARCH-01**: Clean/Hexagonal structure -- Phase 4-5
- [x] **ARCH-02**: No cross-service imports -- Phase 5
- [x] **CNTR-01**: Single source of contracts -- Phase 1
- [x] **CONF-01**: Config via DI -- Phase 2
- [x] **ERR-01**: Error sanitization -- Phase 3
- [x] **HLTH-01**: Parallel health checks -- Phase 6
- [x] **OPS-01**: Structured logging -- Phase 7

## Out of Scope

| Feature | Reason |
|---------|--------|
| Kubernetes | Docker Compose sufficient for current scale |
| Business logic implementation | Focus on infrastructure/CI/CD |
| Testing (unit/integration) | Separate milestone |
| neverthrow / Result pattern | Separate milestone |
| SSL certs management (beyond Traefik auto) | Coolify/Traefik handles auto-TLS |
| Multi-region deployment | Single VPS for now |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DOCK-01 | Phase 15 | Complete |
| DOCK-02 | Phase 15 | Complete |
| DOCK-03 | Phase 15 | Complete |
| DOCK-04 | Phase 15 | Complete |
| CI-01 | Phase 16 | Complete |
| CI-02 | Phase 16 | Complete |
| CI-03 | Phase 16 | Complete |
| DBLD-01 | Phase 17 | Complete |
| DBLD-02 | Phase 17 | Complete |
| DBLD-03 | Phase 17 | Complete |
| DPLY-01 | Phase 18 | Complete |
| DPLY-02 | Phase 18 | Pending |
| DPLY-03 | Phase 18 | Complete |
| VRFY-01 | Phase 19 | Complete |
| VRFY-02 | Phase 19 | Pending |

**Coverage:**
- v3.0 requirements: 15 total
- Mapped to phases: 15
- Unmapped: 0

---
*Requirements defined: 2026-04-04*
*Last updated: 2026-04-04 after v3.0 roadmap creation*
