# Phase 17: Docker Image Build & Push - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated Docker image builds for all 6 services on push to dev and main, published to GHCR with branch-aware tagging. Separate workflow from CI (ci.yml handles PR validation, docker-build.yml handles image publishing).

</domain>

<decisions>
## Implementation Decisions

### Build Trigger
- **D-01:** Separate GitHub Actions workflow file `docker-build.yml` — not part of ci.yml. CI validates PRs, docker-build publishes images on merge.
- **D-02:** Triggers on push to `dev` and `main` branches. Both branches produce deployable images.
- **D-03:** Concurrency group per branch — new push cancels in-progress build for the same branch.

### Tagging Strategy
- **D-04:** Branch-aware tags. dev branch: `dev-<sha7>` + `dev-latest`. main branch: `<sha7>` + `latest`.
- **D-05:** Tags applied per service: `ghcr.io/zerouser-cloud/email-platform-<service>:<tag>`.
- **D-06:** No semver tags for now — can be added later via git tags + release workflow.

### Image Naming
- **D-07:** Image naming pattern: `ghcr.io/zerouser-cloud/email-platform-<service>`. Services: gateway, auth, sender, parser, audience, notifier.
- **D-08:** GHCR owner: `zerouser-cloud` (GitHub user). Use `${{ github.repository_owner }}` in workflow for portability.

### Matrix Strategy
- **D-09:** Matrix strategy builds all 6 services in parallel. Matrix variable: `service: [gateway, auth, sender, parser, audience, notifier]`.
- **D-10:** Single shared Dockerfile (`infra/docker/app.Dockerfile`) with `ARG APP_NAME` — matrix passes service name as build arg.

### Docker Layer Cache
- **D-11:** Docker Buildx with GHA cache backend: `cache-to: type=gha,scope=<service>` / `cache-from: type=gha,scope=<service>`.
- **D-12:** Cache scoped per service via `scope` parameter — no cross-service cache eviction.

### Authentication
- **D-13:** GHCR authentication via `GITHUB_TOKEN` (automatic in GitHub Actions). Login step: `docker/login-action` with `registry: ghcr.io`.
- **D-14:** No additional secrets needed — `GITHUB_TOKEN` has packages:write permission by default for public repos.

### Claude's Discretion
- Exact Buildx setup steps (docker/setup-buildx-action)
- Whether to add `platforms: linux/amd64` explicitly or rely on default
- Workflow job naming and structure

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docker build
- `infra/docker/app.Dockerfile` — Multi-stage Dockerfile with ARG APP_NAME, pnpm deploy, proto bundling
- `infra/docker-compose.yml` — Full-stack compose (reference for service names and build args)

### CI workflow
- `.github/workflows/ci.yml` — Existing CI workflow (PR validation). Docker build workflow is separate but follows same patterns.

### Config
- `packages/config/src/catalog/services.ts` — Service catalog defining all 6 services with IDs

### Skills
- `.agents/skills/infrastructure-guard/SKILL.md` — Port and infra change protocol
- `.agents/skills/twelve-factor/SKILL.md` — No env branching, config from env

### GitHub
- Repository: `zerouser-cloud/email-platform-services` (public)
- Branches: `dev` (working) + `main` (production), both protected

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `infra/docker/app.Dockerfile` — Already supports per-service builds via ARG APP_NAME. Multi-stage (builder + runner), pnpm deploy for production bundle, proto files bundled at /app/proto.
- `.github/workflows/ci.yml` — Reference for GHA patterns: pnpm/action-setup, actions/setup-node, actions/cache.

### Established Patterns
- Dockerfile uses BuildKit cache mount for pnpm store (`--mount=type=cache,id=pnpm,target=/pnpm/store`)
- Services are defined in `packages/config/src/catalog/services.ts` — source of truth for service list
- CI uses concurrency groups per PR — docker-build should use per-branch concurrency

### Integration Points
- Phase 18 (Deployment) will `docker compose pull` these images from GHCR
- docker-compose.yml currently uses `build:` directive — production compose will use `image:` pointing to GHCR

</code_context>

<specifics>
## Specific Ideas

- Один Dockerfile для всех сервисов — matrix передаёт APP_NAME как build-arg
- dev-образы для staging/тестирования на сервере, main-образы для production
- `docker pull ghcr.io/zerouser-cloud/email-platform-gateway:latest` должен работать и запускаться

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 17-docker-image-build-push*
*Context gathered: 2026-04-04*
