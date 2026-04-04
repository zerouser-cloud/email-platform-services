# Feature Landscape: CI/CD & Docker Workflows

**Domain:** CI/CD pipeline for NestJS microservices monorepo
**Researched:** 2026-04-04

## Table Stakes

Features that any production-ready monorepo CI/CD must have.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| PR quality gate (lint + typecheck + build) | Prevents broken code from merging | Low | Turbo handles task graph, just wire to GH Actions |
| Docker image build automation | Manual builds don't scale, drift between code and image | Medium | Matrix strategy for 6 services, BuildKit caching |
| Container registry | Images need to be stored and versioned somewhere | Low | GHCR, native GH integration |
| Environment file management | .env/.env.docker/.env.example must stay in sync | Low | Template-based with validation |
| Docker Compose split (infra vs full) | Two dev modes: host-dev and full-docker | Low | Separate compose files with shared network |
| Health check verification in deploy | Must confirm services are healthy after deploy | Low | Already have health endpoints, just verify in CI/deploy |
| Non-root container execution | Security baseline | Low | Already implemented (appuser in Dockerfile) |
| .dockerignore optimization | Prevent secrets/unnecessary files in build context | Low | Already solid, minor additions needed |

## Differentiators

Features that improve DX and reliability beyond the basics.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Turbo remote cache in CI | Skip unchanged package rebuilds across PRs, 2-5x faster CI | Low | rharkor/caching-for-turbo, zero config |
| Affected-only CI execution | Only lint/build changed packages on PR | Low | `turbo run build --filter='...[origin/main]'` |
| Docker layer caching in CI | Reuse image layers across builds, 3-10x faster image builds | Medium | `type=gha` cache backend with docker/build-push-action |
| Parallel matrix builds for services | Build 6 images concurrently, not sequentially | Low | GH Actions matrix strategy |
| Image tag with commit SHA | Full traceability from running container to source commit | Low | Tag format: `main-<sha7>` |
| Separate deploy workflow | Decouple build from deploy, support rollbacks | Low | workflow_dispatch trigger |
| Proto contract change detection | Rebuild all dependent services when proto files change | Low | Turbo dependency graph already handles this via `generate` task |

## Anti-Features

Features to explicitly NOT build at this stage.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Kubernetes/Helm deployment | Over-engineering for 6 services on one VPS, deferred per project decision | Docker Compose on VPS |
| Multi-environment pipelines (dev/staging/prod) | Only one environment needed now, premature abstraction | Single deploy target, add environments when needed |
| Automated rollback | Requires monitoring/alerting infrastructure that doesn't exist | Manual rollback via `docker compose up -d` with previous image tag |
| Canary/blue-green deployment | Requires load balancer and traffic splitting -- overkill for single VPS | Direct restart with health checks |
| Monorepo-aware Docker build (turbo prune) | `turbo prune` creates workspace subsets for Docker; the existing `pnpm deploy` approach is simpler and already works | Keep current `pnpm deploy --filter --prod` pattern |
| Self-hosted runners | GitHub-hosted are sufficient, self-hosted adds maintenance burden | Use ubuntu-latest |
| Automated dependency updates (Renovate/Dependabot) | Useful but separate concern, not part of core CI/CD setup | Add later as independent workflow |

## Feature Dependencies

```
Docker Compose split --> Environment management (split needs clear env sourcing)
Environment management --> CI pipeline (CI needs to know which env to use)
CI pipeline --> Docker image builds (images only built if CI passes)
Docker image builds --> Deploy workflow (deploy pulls built images)
```

## MVP Recommendation

Prioritize:
1. Docker Compose split (infra vs full) -- enables both dev modes immediately
2. Environment file management (.env sync strategy) -- prerequisite for everything else
3. CI pipeline with Turbo cache -- automated quality gate on every PR
4. Docker image build + push to GHCR -- automated image creation on main

Defer:
- Deploy workflow: can do manually (`ssh + docker compose pull + up -d`) until automated deploy is tested
- Multi-environment support: one target is enough for now

## Sources

- [GitHub Actions Monorepo Guide (WarpBuild)](https://www.warpbuild.com/blog/github-actions-monorepo-guide)
- [Turborepo GitHub Actions Guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions)
- [Docker Compose in Production (Docker Docs)](https://docs.docker.com/compose/how-tos/production/)
