# Project Research Summary

**Project:** Email Platform v3.0 Infrastructure & CI/CD
**Domain:** CI/CD pipeline and Docker orchestration for NestJS microservices monorepo
**Researched:** 2026-04-04
**Confidence:** HIGH

## Executive Summary

This milestone establishes the infrastructure and CI/CD foundation for a 6-service NestJS monorepo (gateway, auth, sender, parser, audience, notifier) with 3 shared packages. The recommended approach is GitHub Actions for CI/CD, GHCR for container registry, and Docker Compose on a single VPS for deployment -- no Kubernetes. The existing Dockerfile is already solid (multi-stage, BuildKit cache mounts, pnpm deploy, non-root user); the main work is splitting Docker Compose files, fixing environment management, and wiring up CI pipelines with proper caching.

The stack choices are straightforward and well-validated: GitHub Actions with Turbo remote cache via `rharkor/caching-for-turbo`, matrix builds for parallel Docker image creation, and scoped GHA cache to prevent eviction across 6 services. The three-file Docker Compose split (infra-only, full-dev, production) using the `include` directive enables two development modes -- local dev with host-run NestJS services and full-Docker integration testing. Caddy as a reverse proxy on the VPS handles automatic HTTPS with minimal configuration.

The primary risks are cache eviction in CI (6 services competing for 10GB GHA cache), environment file drift between `.env` and `.env.docker`, and Docker layer cache invalidation from non-dependency package.json changes. All have known mitigations: scoped cache keys per service, `.env.example` as source of truth with CI validation, and `pnpm fetch` before `pnpm install --offline`. The total VPS footprint fits on an 8GB Hetzner instance (~4GB for all 10 containers).

## Key Findings

### Recommended Stack

All tooling is GitHub-native or already in use. No new dependencies are added to `package.json`.

**Core technologies:**
- **GitHub Actions** (CI/CD) -- native GHCR integration, free tier sufficient, first-class pnpm/Turbo support
- **GHCR** (container registry) -- unlimited private repos, same auth as code, no rate limits from own repos
- **rharkor/caching-for-turbo v2.2.1** (Turbo remote cache) -- uses GH native cache backend, no Vercel dependency, zero config
- **docker/build-push-action v6** (image builds) -- BuildKit integration, `type=gha` layer caching, scoped per service
- **Docker Compose V2** (orchestration) -- already in use, `include` directive for modular composition, matches current scale
- **Caddy** (reverse proxy) -- automatic HTTPS via Let's Encrypt, 3-line config, HTTP/2 by default
- **appleboy/ssh-action** (deploy) -- SSH to VPS, minimal infrastructure

### Expected Features

**Must have (table stakes):**
- PR quality gate: lint + typecheck + build via Turbo with affected-only execution
- Docker image build automation with matrix strategy for 6 services
- Container registry (GHCR) with SHA + latest tagging
- Docker Compose split: infra-only for local dev, full-stack for integration, prod with pre-built images
- Environment file management with `.env.example` as source of truth
- Health check verification in deployment
- Non-root container execution (already implemented)

**Should have (differentiators):**
- Turbo remote cache in CI (2-5x faster builds)
- Affected-only CI execution (`--filter='...[origin/main]'`)
- Docker layer caching with scoped GHA cache (3-10x faster image builds)
- Separate deploy workflow decoupled from build
- Proto contract change detection (Turbo dependency graph handles automatically)

**Defer (v2+):**
- Multi-environment pipelines (dev/staging/prod) -- one target is enough now
- Automated rollback (requires monitoring infrastructure)
- Canary/blue-green deployments (requires load balancer)
- Self-hosted runners (GitHub-hosted are sufficient)
- Automated dependency updates (Renovate/Dependabot) -- separate concern

### Architecture Approach

Three-file Docker Compose architecture using the `include` directive (stable since Compose V2.20+): `docker-compose.infra.yml` for backing services, `docker-compose.yml` for full-dev builds from source, and `docker-compose.prod.yml` for production with pre-built GHCR images. Two Docker networks isolate concerns: `infra` for backing services and `services` for inter-service gRPC. Gateway lives only on `services`; all other app services bridge both networks.

**Major components:**
1. **Docker Compose infra file** -- standalone backing services (postgres, redis, rabbitmq, minio) with health checks and host-exposed ports. Critical fix: redis, rabbitmq, minio currently lack port mappings for host access.
2. **CI pipeline (`ci.yml`)** -- PR validation with affected-only Turbo execution, pnpm store caching, concurrency grouping with cancel-in-progress.
3. **Deploy pipeline (`deploy.yml`)** -- change detection via `turbo ls --affected`, matrix Docker builds with scoped GHA cache, SSH deploy to VPS.
4. **Environment management** -- three-file strategy (.env.example tracked, .env and .env.docker untracked), differing only in hostnames and log format. Remove NODE_ENV from .env.docker. Hardcode POSTGRES_PORT to 5432.
5. **Production deployment** -- pre-built images from GHCR, resource limits (4GB total for 10 containers), Caddy reverse proxy with auto-TLS.

### Critical Pitfalls

1. **GHA cache eviction across 6 Docker builds** -- use `scope=${{ matrix.service }}` in both cache-from and cache-to to prevent last-writer-wins on the 10GB cache limit
2. **pnpm install cache bust from package.json metadata changes** -- use `pnpm fetch` (depends only on lockfile) before `pnpm install --offline` for better Docker layer caching
3. **Environment file drift** -- `.env.example` as single source of truth, CI validation step comparing keys across files, Zod schema as runtime backup
4. **Docker network isolation breaking gRPC** -- explicit shared network definitions in both compose files, verify merging with `docker compose config`
5. **NODE_ENV override in .env.docker** -- remove `NODE_ENV=development` which defeats Dockerfile's `NODE_ENV=production` for V8/Express optimizations

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Docker Compose Split and Environment Management
**Rationale:** Foundation for both local development and CI/CD. Everything downstream depends on correct compose files and environment configuration. These two concerns are tightly coupled (compose files reference env files).
**Delivers:** Three compose files (infra, dev, prod), two working development modes, environment file strategy, port exposure fixes for redis/rabbitmq/minio, POSTGRES_PORT removed (hardcoded), package.json convenience scripts (`infra:up`, `infra:down`, `docker:up`, `docker:down`).
**Addresses:** Docker Compose split, environment management, .dockerignore optimization, 12-Factor compliance fixes (Factors III, V, X).
**Avoids:** Network isolation pitfall, env file drift pitfall, NODE_ENV override issue.

### Phase 2: Dockerfile Optimization
**Rationale:** Must be correct before CI builds images. The `pnpm fetch` optimization is a prerequisite for efficient CI Docker builds.
**Delivers:** Optimized Dockerfile with `pnpm fetch` for better layer caching, verified .dockerignore (add `.claude/`), PROTO_DIR in both env files.
**Avoids:** pnpm store cache miss pitfall, secrets in build context pitfall.

### Phase 3: CI Pipeline (PR Validation)
**Rationale:** Quality gate must exist before automated image builds. This is the simpler workflow and validates the Turbo + pnpm + GH Actions integration.
**Delivers:** `.github/workflows/ci.yml` with lint/typecheck/build on PRs, Turbo remote cache via rharkor/caching-for-turbo, affected-only execution via `--filter='...[origin/main]'`, concurrency grouping.
**Avoids:** Turbo cache poisoning (correct task inputs), first-run timeout (set generous initial timeout).

### Phase 4: Docker Image Build and Push
**Rationale:** Depends on working CI pipeline and optimized Dockerfile. Matrix strategy for parallel builds is essential for 6 services.
**Delivers:** Build-push jobs in deploy workflow, change detection via `turbo ls --affected`, matrix builds for 6 services, GHCR integration with GITHUB_TOKEN, scoped GHA Docker cache, dual tagging (SHA + latest).
**Avoids:** GHA cache eviction pitfall (scoped keys), GHCR permission issues (`packages: write`).

### Phase 5: VPS Deployment
**Rationale:** Final step -- depends on images being built and pushed to GHCR. Includes server-side setup.
**Delivers:** SSH deploy job in workflow, production compose with resource limits, Caddy reverse proxy config, health check verification post-deploy, rollback documentation (manual: specify previous image tag).
**Avoids:** Over-engineering (no K8s), deploying all services on every change (uses affected detection from Phase 4).

### Phase Ordering Rationale

- Phases 1-2 are local-only changes with no CI dependency -- they can be validated immediately on the developer machine
- Phase 3 (CI) must come before Phase 4 (Docker builds) because the deploy workflow should gate on CI passing
- Phase 4 (image builds) must come before Phase 5 (deploy) because deploy pulls pre-built images from GHCR
- The dependency chain mirrors the feature dependency graph from FEATURES.md: `compose split -> env management -> CI -> Docker builds -> deploy`
- Grouping compose split with environment management (Phase 1) avoids a second pass through compose files later

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 5 (VPS Deployment):** SSH key management for GH Actions secrets, GHCR authentication on VPS (`docker login ghcr.io`), Caddy systemd service configuration, resource limit tuning under realistic load. Server-specific details are not fully covered by research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Compose Split):** Docker Compose `include` directive is well-documented, straightforward YAML refactoring
- **Phase 2 (Dockerfile):** `pnpm fetch` pattern is documented in official pnpm Docker docs, minimal change
- **Phase 3 (CI Pipeline):** Turborepo has an official GitHub Actions guide with near-copy-paste examples
- **Phase 4 (Docker Builds):** docker/build-push-action v6 is extremely well documented with matrix examples

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All tools are GitHub-native or already in use. No novel choices. Official docs verified. |
| Features | HIGH | Clear table-stakes vs differentiators. Feature dependency chain well-mapped. |
| Architecture | HIGH | Docker Compose `include` stable since V2.20+. Three-file pattern widely adopted. CI workflow patterns verified against Turborepo official guide. |
| Pitfalls | HIGH | Verified against official docs and community incident reports. GHA cache scoping confirmed in docker/build-push-action docs. |

**Overall confidence:** HIGH

### Gaps to Address

- **SIGTERM/graceful shutdown:** Architecture research flags 12-Factor IX (Disposability) as VERIFY status. Each NestJS service needs confirmed SIGTERM handling before production deployment. Address during Phase 1 or 2 -- check that `enableShutdownHooks()` is called and `init: true` is set in compose.
- **Turbo `ls --affected` reliability:** The change detection script in the deploy workflow uses `turbo ls --affected` piped through grep/sed/jq. This is a newer Turbo feature -- validate it works correctly with the current Turbo version before relying on it in Phase 4. Fallback: build all services.
- **`include` directive network merging:** Architecture notes recommend verifying network merging with `docker compose config`. Test explicitly in Phase 1 to catch issues early.
- **VPS sizing validation:** The ~4GB estimate for 10 containers is theoretical based on resource limit declarations. Validate under realistic load before committing to Hetzner CX32 (4 vCPU, 8GB RAM).
- **Secret management for production:** How production secrets (DB passwords, API keys, JWT secrets) are delivered to the VPS is not covered. Options: GH Actions secrets injected via SSH, `.env` file on server, or a vault solution. Decide during Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- [Turborepo GitHub Actions Guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions)
- [pnpm Docker Documentation](https://pnpm.io/docker)
- [Docker Compose `include` directive](https://www.docker.com/blog/improve-docker-compose-modularity-with-include/)
- [Docker Compose production best practices](https://docs.docker.com/compose/how-tos/production/)
- [Docker multiple compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/)

### Secondary (MEDIUM confidence)
- [rharkor/caching-for-turbo](https://github.com/rharkor/caching-for-turbo)
- [GitHub Actions monorepo guide (WarpBuild)](https://www.warpbuild.com/blog/github-actions-monorepo-guide)
- [GHCR vs Docker Hub comparison (cloudonaut)](https://cloudonaut.io/amazon-ecr-vs-docker-hub-vs-github-container-registry/)
- [Optimized Docker builds with TurboRepo and PNPM](https://fintlabs.medium.com/optimized-multi-stage-docker-builds-with-turborepo-and-pnpm-for-nodejs-microservices-in-a-monorepo-c686fdcf051f)
- [GitHub Actions supply chain security (2026)](https://dev.to/trknhr/lessons-from-the-spring-2026-oss-incidents-hardening-npm-pnpm-and-github-actions-against-1jnp)
- [Docker Compose production pitfalls](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong)
- [Microservice deployment patterns](https://semaphore.io/blog/deploy-microservices)
- [Caching pnpm in Docker builds (DEV Community)](https://dev.to/henryjw/caching-pnpm-modules-in-docker-builds-in-github-actions-mj7)
- [Docker BuildKit cache mounts (Depot)](https://depot.dev/blog/how-to-use-cache-mount-to-speed-up-docker-builds)

---
*Research completed: 2026-04-04*
*Ready for roadmap: yes*
