# Technology Stack: CI/CD & Docker Workflows

**Project:** Email Platform v3.0 Infrastructure & CI/CD
**Researched:** 2026-04-04

## Recommended Stack

### CI/CD Platform
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Actions | N/A (hosted) | CI/CD pipeline | Already on GitHub, native GHCR integration, free tier sufficient (2000 min/month), first-class pnpm/Turbo support |
| rharkor/caching-for-turbo | v2.2.1 | Turbo remote cache in CI | Uses GitHub's native cache backend -- no Vercel account, no external dependency, zero-config |
| pnpm/action-setup | v4 | pnpm installation in CI | Official pnpm action, handles corepack and version pinning |
| actions/setup-node | v4 | Node.js setup | Cache pnpm store via `cache: 'pnpm'` option |
| docker/build-push-action | v6 | Docker image builds | BuildKit integration, layer caching, multi-platform support |
| docker/login-action | v3 | Registry auth | GHCR login in CI |

### Container Registry
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| GitHub Container Registry (ghcr.io) | N/A | Docker image hosting | Unlimited private repos on GitHub plans, native Actions integration, no rate limits from own repos, same auth as code |

### Docker Build
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker BuildKit | Default in Docker 23+ | Image building | Cache mounts, parallel multi-stage, already used in existing Dockerfile |
| Node 20-alpine | 20-alpine | Base image | Already used, smallest Node image with musl libc |

### Local Development
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker Compose V2 | 2.x (CLI plugin) | Local orchestration | Already in use, health checks, network isolation, volumes |
| dotenv-cli | 11.x | Env loading for host-mode dev | Already a dependency, loads .env for `turbo run dev` |

### Deployment (VPS target)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Docker Compose | 2.x | Production orchestration | Matches current scale (6 services), simple, K8s deferred per project decision |
| SSH deploy via GH Actions | N/A | Remote deployment | `appleboy/ssh-action` or direct SSH -- minimal, no extra infra |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| CI/CD | GitHub Actions | GitLab CI, CircleCI | Already on GitHub, switching adds complexity with no benefit at this scale |
| CI/CD | GitHub Actions | Self-hosted runners | Not needed yet -- GitHub-hosted runners are sufficient for 6 services |
| Remote cache | rharkor/caching-for-turbo | Vercel Remote Cache | Requires Vercel account, external dependency, paid at scale |
| Remote cache | rharkor/caching-for-turbo | Self-hosted S3 cache | Over-engineering for current team size |
| Registry | GHCR | Docker Hub | Rate limits on free tier (100 pulls/6h anonymous), 1 private repo on free plan |
| Registry | GHCR | AWS ECR | Adds AWS dependency, more complex auth, not needed without K8s/ECS |
| Deployment | Docker Compose on VPS | Kubernetes | Explicitly deferred per KEY DECISIONS in PROJECT.md, 6 services is too small |
| Deployment | Docker Compose on VPS | Coolify/Dokploy | Self-hosted PaaS adds a layer of abstraction -- useful but not essential |
| Base image | node:20-alpine | distroless | Distroless is smaller/more secure but lacks shell for health checks (wget in healthcheck) |

## Dockerfile Improvements (over existing)

The existing Dockerfile is already solid. Recommended minor improvements:

### 1. Use `pnpm fetch` before full install (better CI cache)
```dockerfile
# After copying lockfile, before copying package.json manifests:
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm fetch --frozen-lockfile

# Then copy manifests and install offline:
COPY package.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/foundation/package.json packages/foundation/package.json
ARG APP_NAME
COPY apps/${APP_NAME}/package.json apps/${APP_NAME}/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --offline
```
`pnpm fetch` only needs the lockfile, so the layer cache survives even when package.json metadata changes (like version bumps or script changes). This turns `pnpm install` into an offline operation that just links already-fetched packages.

### 2. Add .claude/ to .dockerignore
Already mostly excluded but verify `.claude/` is listed (contains agent tooling not needed in images).

## GitHub Actions Workflow Structure

```
.github/
  workflows/
    ci.yml          # lint, typecheck, build (on PR + push to main)
    docker.yml      # build + push images (on push to main, tags)
    deploy.yml      # deploy to VPS (on workflow_dispatch or tag)
```

### CI Workflow Key Points
- Trigger: PR to main, push to main
- Steps: checkout, pnpm setup, turbo cache setup, `pnpm install --frozen-lockfile`, `turbo run lint typecheck build`
- Turbo handles task ordering and only runs affected packages
- Total CI time target: under 5 minutes for typical PR

### Docker Build Workflow Key Points
- Trigger: push to main (or semantic version tags)
- Matrix strategy: build 6 service images in parallel
- Each matrix job: `docker/build-push-action` with `build-args: APP_NAME=${{ matrix.service }}`
- Push to `ghcr.io/<org>/email-platform-<service>:latest` and `:<sha-short>`
- Use `type=gha` cache backend for Docker layer caching

### Deploy Workflow Key Points
- Trigger: manual (workflow_dispatch) or after docker workflow completes
- SSH into VPS, pull new images, `docker compose up -d`
- Rolling restart with health check verification

## Image Tagging Strategy

```
ghcr.io/<org>/email-platform-gateway:latest       # latest from main
ghcr.io/<org>/email-platform-gateway:main-abc1234  # commit SHA
ghcr.io/<org>/email-platform-gateway:v1.0.0        # semantic version (on tag)
```

Use `latest` for dev/staging, commit SHA for traceability, semantic version for production pins.

## Installation

No new dependencies needed for CI/CD -- all tooling is GitHub Actions-based. Local development tools are already in place.

```bash
# No changes to package.json required
# GitHub Actions are defined in YAML, not installed locally

# Verify existing setup works:
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm typecheck
```

## Sources

- [Turborepo GitHub Actions Guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions)
- [pnpm Docker Documentation](https://pnpm.io/docker)
- [pnpm deploy CLI](https://pnpm.io/cli/deploy)
- [rharkor/caching-for-turbo](https://github.com/rharkor/caching-for-turbo)
- [GHCR vs Docker Hub (cloudonaut)](https://cloudonaut.io/amazon-ecr-vs-docker-hub-vs-github-container-registry/)
- [GitHub Actions Monorepo Guide (WarpBuild)](https://www.warpbuild.com/blog/github-actions-monorepo-guide)
- [Docker Compose in Production (Docker Docs)](https://docs.docker.com/compose/how-tos/production/)
- [Optimized Docker builds with TurboRepo and PNPM](https://fintlabs.medium.com/optimized-multi-stage-docker-builds-with-turborepo-and-pnpm-for-nodejs-microservices-in-a-monorepo-c686fdcf051f)
