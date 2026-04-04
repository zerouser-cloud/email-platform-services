# Domain Pitfalls: CI/CD & Docker Workflows

**Domain:** CI/CD pipeline for NestJS microservices monorepo with pnpm + Turbo
**Researched:** 2026-04-04
**Confidence:** HIGH (verified against official docs, community patterns, real-world incidents)

## Critical Pitfalls

Mistakes that cause CI failures, broken deployments, or security issues.

### Pitfall 1: GHA Cache Eviction with Multiple Docker Builds
**What goes wrong:** 6 service Docker builds share the 10 GB GitHub Actions cache. Without scoping, each build overwrites the previous one's cache, resulting in zero cache hits.
**Why it happens:** `docker/build-push-action` defaults to a single cache scope. With 6 matrix jobs writing to the same scope, the last writer wins.
**Consequences:** Every build is a cold build. Image build times 3-10x slower than expected.
**Prevention:** Use `scope=${{ matrix.service }}` in both `cache-from` and `cache-to` parameters of build-push-action.
**Detection:** CI image build times consistently 5+ minutes per service with no improvement over time.

### Pitfall 2: pnpm Store Cache Miss in Docker
**What goes wrong:** Changing any `package.json` field (scripts, version, description) busts the Docker layer cache for `pnpm install`, triggering a full reinstall even when dependencies haven't changed.
**Why it happens:** Docker layer caching is content-hash based. The install layer depends on all copied package.json files. Any metadata change invalidates it.
**Consequences:** Slow Docker builds (2-5 minutes for install instead of seconds).
**Prevention:** Use `pnpm fetch` which depends only on `pnpm-lock.yaml`. The lockfile only changes when actual dependencies change. Follow with `pnpm install --offline`.
**Detection:** Build logs show full download/install when only non-dependency changes were made.

### Pitfall 3: Secrets Leaked via Docker Build Context
**What goes wrong:** `.env` files, credentials, or API keys end up in Docker image layers.
**Why it happens:** Forgetting to update `.dockerignore`, or using `COPY . .` before filtering.
**Consequences:** Anyone with image access can extract secrets from any layer.
**Prevention:** Current `.dockerignore` already excludes `.env*`. Verify it stays updated. Never use `COPY . .` -- copy specific directories. Current Dockerfile correctly copies specific paths.
**Detection:** Run `docker history <image>` to inspect layers. Use `dive` tool to inspect image contents.

### Pitfall 4: env_file Mismatch Between Dev and Docker
**What goes wrong:** `.env` (for host dev) and `.env.docker` (for Docker) drift apart. A new config var is added to one but not the other.
**Why it happens:** Manual synchronization of multiple env files with no validation.
**Consequences:** Service works in dev but crashes in Docker (or vice versa). Hard to debug because the error is "missing env var" which could be anything.
**Prevention:** Single `.env.example` as source of truth. CI step that validates both `.env` and `.env.docker` contain all keys from `.env.example`. The Zod schema in `@email-platform/config` already validates at runtime -- but failing at compose-up time is too late.
**Detection:** Services fail health checks in one mode but not the other.

## Moderate Pitfalls

### Pitfall 5: Turbo Cache Poisoning
**What goes wrong:** A Turbo cache entry contains stale or incorrect output, and subsequent builds skip the task thinking it's already done correctly.
**Prevention:** Include all relevant inputs in turbo.json task config. The existing config already does this well (`inputs` for generate task). If cache behaves oddly, `turbo run build --force` bypasses cache.

### Pitfall 6: Docker Compose Network Isolation Breaks gRPC
**What goes wrong:** When splitting compose files, services can't reach infrastructure or each other because they're on different Docker networks.
**Why it happens:** Each compose file creates its own default network. Services in `services.yml` need to be on the same network as `infra.yml`.
**Prevention:** Explicitly define shared networks in both compose files. Use `external: true` for the network in the services file, or define networks in both and merge.

### Pitfall 7: BuildKit Cache Mount Not Available in CI
**What goes wrong:** `RUN --mount=type=cache` works locally but has no effect in ephemeral CI runners because the cache is destroyed between runs.
**Why it happens:** CI runners are fresh VMs. BuildKit cache mounts are local to the build host.
**Prevention:** For CI, rely on Docker layer caching (`type=gha` cache backend) rather than BuildKit cache mounts. The mounts still help locally and don't hurt in CI -- they just provide no benefit there.

### Pitfall 8: `pnpm deploy` Fails with Workspace Protocol
**What goes wrong:** `pnpm deploy` fails or produces incomplete output when workspace packages use `workspace:*` protocol without proper configuration.
**Prevention:** Ensure all workspace references use `workspace:*` (already the case). The `--prod` flag correctly strips devDependencies. Test `pnpm deploy` locally before relying on it in CI.

## Minor Pitfalls

### Pitfall 9: GitHub Actions Timeout on First Run
**What goes wrong:** First CI run takes 15+ minutes because there's no Turbo cache and no Docker layer cache. Default GH Actions timeout is 360 minutes, but if set to a tight value, it fails.
**Prevention:** Set `timeout-minutes: 20` for the first run, then tighten to 10-15 once caches warm up.

### Pitfall 10: GHCR Login Requires Package Write Permission
**What goes wrong:** `docker push` to GHCR fails with 403.
**Prevention:** Ensure the workflow has `packages: write` permission in the `permissions` block. For organization repos, verify the package visibility settings.

### Pitfall 11: Compose V2 `depends_on` with `condition` Not Waiting
**What goes wrong:** Services start before dependencies are healthy despite `condition: service_healthy`.
**Prevention:** Already correctly implemented in the existing compose file. Just ensure the split files preserve these conditions.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Docker Compose split | Network isolation breaks inter-service communication | Shared external network definition |
| Environment management | .env and .env.docker drift | CI validation step, single .env.example source of truth |
| CI pipeline setup | First run very slow (cold cache) | Expected, document for team. Caches warm after 1-2 runs |
| Docker image builds | Cache eviction between services | Scoped cache keys per service |
| Deploy workflow | SSH key management, GHCR auth on VPS | Store SSH key as GH secret, `docker login ghcr.io` on VPS |

## Sources

- [pnpm Docker Documentation](https://pnpm.io/docker)
- [Docker BuildKit Cache Mounts (Depot)](https://depot.dev/blog/how-to-use-cache-mount-to-speed-up-docker-builds)
- [GitHub Actions Supply Chain Security (2026)](https://dev.to/trknhr/lessons-from-the-spring-2026-oss-incidents-hardening-npm-pnpm-and-github-actions-against-1jnp)
- [Docker Compose Production Best Practices](https://docs.docker.com/compose/how-tos/production/)
- [Caching pnpm in Docker Builds (DEV Community)](https://dev.to/henryjw/caching-pnpm-modules-in-docker-builds-in-github-actions-mj7)
