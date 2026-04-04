# Phase 17: Docker Image Build & Push - Research

**Researched:** 2026-04-04
**Domain:** GitHub Actions CI/CD, Docker Buildx, GHCR
**Confidence:** HIGH

## Summary

This phase creates a GitHub Actions workflow (`docker-build.yml`) that builds Docker images for all 6 services in parallel using matrix strategy and pushes them to GHCR. The existing `infra/docker/app.Dockerfile` already supports per-service builds via `ARG APP_NAME`, so no Dockerfile changes are needed. The workflow uses Docker's official GHA ecosystem: `docker/login-action`, `docker/setup-buildx-action`, `docker/metadata-action`, and `docker/build-push-action`.

The main technical consideration is GHA cache scoping: by default, Buildx GHA cache uses a single scope (`buildkit`), so building 6 services in parallel would cause cache eviction. The solution is explicit `scope=${{ matrix.service }}` on both `cache-from` and `cache-to` parameters. The Dockerfile also uses `--mount=type=cache` for pnpm store, but this is a BuildKit-local cache mount (not preserved by GHA cache backend). However, with proper Docker layer caching via GHA, the pnpm install layer is already cached when package.json files haven't changed, making the cache mount a nice-to-have for local builds only.

**Primary recommendation:** Single workflow file with matrix strategy, `docker/build-push-action@v7`, GHA cache scoped per service, branch-aware tags via `docker/metadata-action@v6`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Separate workflow file `docker-build.yml` -- not part of ci.yml
- **D-02:** Triggers on push to `dev` and `main` branches
- **D-03:** Concurrency group per branch -- new push cancels in-progress build
- **D-04:** Branch-aware tags: dev branch gets `dev-<sha7>` + `dev-latest`, main branch gets `<sha7>` + `latest`
- **D-05:** Tags per service: `ghcr.io/zerouser-cloud/email-platform-<service>:<tag>`
- **D-06:** No semver tags for now
- **D-07:** Image naming: `ghcr.io/zerouser-cloud/email-platform-<service>`
- **D-08:** GHCR owner via `${{ github.repository_owner }}` for portability
- **D-09:** Matrix strategy for all 6 services in parallel
- **D-10:** Single shared Dockerfile with `ARG APP_NAME`
- **D-11:** Docker Buildx with GHA cache backend, `scope=<service>`
- **D-12:** Cache scoped per service -- no cross-service eviction
- **D-13:** GHCR auth via `GITHUB_TOKEN` + `docker/login-action`
- **D-14:** No additional secrets needed

### Claude's Discretion
- Exact Buildx setup steps (docker/setup-buildx-action)
- Whether to add `platforms: linux/amd64` explicitly or rely on default
- Workflow job naming and structure

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DBLD-01 | Docker image build per service via matrix strategy in GitHub Actions | Matrix strategy with `service: [gateway, auth, sender, parser, audience, notifier]`, `docker/build-push-action@v7` with `build-args: APP_NAME=${{ matrix.service }}` |
| DBLD-02 | Images published to GHCR (GitHub Container Registry) | `docker/login-action@v4` with `registry: ghcr.io`, GITHUB_TOKEN with `packages: write` permission |
| DBLD-03 | Scoped Docker layer cache per service | GHA cache backend with `scope=${{ matrix.service }}` on both cache-from and cache-to, `mode=max` for full layer export |
</phase_requirements>

## Standard Stack

### Core GitHub Actions
| Action | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| docker/build-push-action | v7 | Build and push Docker images | Official Docker action, latest major version |
| docker/setup-buildx-action | v4 | Set up Docker Buildx builder | Required for GHA cache backend and advanced features |
| docker/login-action | v4 | Authenticate to GHCR | Official Docker registry login action |
| docker/metadata-action | v6 | Generate tags and labels from Git metadata | Standard tag generation, handles branch/SHA logic |
| actions/checkout | v4 | Check out repository | Standard GHA checkout |

### Supporting
| Action | Version | Purpose | When to Use |
|--------|---------|---------|-------------|
| docker/setup-qemu-action | v3 | Multi-platform build support | Only if multi-arch needed (NOT needed now -- single platform) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| docker/metadata-action | Manual tag generation | metadata-action handles edge cases (PR refs, semver), but manual is simpler for fixed patterns |
| GHA cache backend | Registry cache (`type=registry`) | Registry cache pushes layers to a separate GHCR repo; GHA cache is simpler but has 10GB repo limit |

## Architecture Patterns

### Workflow File Structure
```
.github/
  workflows/
    ci.yml              # PR validation (existing)
    docker-build.yml    # Image build & push (new)
```

### Pattern 1: Matrix Build with Scoped Cache
**What:** Single workflow job using matrix strategy to build 6 services in parallel, each with isolated GHA cache scope.
**When to use:** When building multiple images from a single Dockerfile with build args.
**Example:**
```yaml
# Source: Docker official docs + verified patterns
jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        service: [gateway, auth, sender, parser, audience, notifier]
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v4

      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v6
        id: meta
        with:
          images: ghcr.io/${{ github.repository_owner }}/email-platform-${{ matrix.service }}
          tags: |
            type=sha,prefix=dev-,enable=${{ github.ref == 'refs/heads/dev' }}
            type=raw,value=dev-latest,enable=${{ github.ref == 'refs/heads/dev' }}
            type=sha,prefix=,enable=${{ github.ref == 'refs/heads/main' }}
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - uses: docker/build-push-action@v7
        with:
          context: .
          file: infra/docker/app.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: APP_NAME=${{ matrix.service }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

### Pattern 2: Branch-Aware Tagging via metadata-action
**What:** Use `docker/metadata-action` with conditional `enable` flags to produce different tag sets per branch.
**When to use:** When dev and main branches need different tag prefixes.
**Key insight:** The `type=sha` flavor generates 7-char SHA tags by default. The `enable` parameter conditionally includes/excludes tag rules based on branch.

### Pattern 3: Concurrency Groups per Branch
**What:** Cancel in-progress builds when a new push arrives to the same branch.
**Example:**
```yaml
concurrency:
  group: docker-${{ github.ref }}
  cancel-in-progress: true
```

### Anti-Patterns to Avoid
- **Shared cache scope across matrix jobs:** Without explicit `scope`, all 6 services overwrite each other's cache, leaving only the last build cached.
- **Using `type=inline` cache:** Inline cache only supports `mode=min` (final layer only). Use `type=gha` with `mode=max` for full layer caching.
- **Hardcoding GHCR owner:** Use `${{ github.repository_owner }}` for portability instead of hardcoded `zerouser-cloud`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tag generation | Shell script parsing git ref/sha | `docker/metadata-action@v6` | Handles edge cases (detached HEAD, tag refs, PR refs), generates OCI labels |
| GHCR authentication | Manual `docker login` command | `docker/login-action@v4` | Secure credential handling, no secrets in logs |
| Buildx setup | Manual `docker buildx create` | `docker/setup-buildx-action@v4` | Configures builder with GHA cache support automatically |
| SHA extraction | `github.sha` substring | `type=sha` in metadata-action | Handles short SHA correctly, configurable prefix/length |

**Key insight:** The Docker GHA ecosystem is tightly integrated. Using official actions together avoids subtle issues with token handling, cache configuration, and build context setup.

## Common Pitfalls

### Pitfall 1: GHA Cache Eviction in Matrix Builds
**What goes wrong:** All 6 services share default `buildkit` cache scope. Each build overwrites the previous cache. Only the last service to finish has a warm cache.
**Why it happens:** Default `scope=buildkit` is shared across all builds in a repo.
**How to avoid:** Explicit `scope=${{ matrix.service }}` on both `cache-from` and `cache-to`.
**Warning signs:** Cache hit rate near 0% despite no code changes. Build times don't improve after first run.

### Pitfall 2: GITHUB_TOKEN Missing packages:write Permission
**What goes wrong:** `docker push` fails with 403 Forbidden.
**Why it happens:** Default GITHUB_TOKEN permissions may not include `packages:write` depending on repo/org settings.
**How to avoid:** Explicitly set `permissions: { contents: read, packages: write }` at job level.
**Warning signs:** First push always fails. Error message mentions authentication or forbidden.

### Pitfall 3: Cache Mount vs Layer Cache Confusion
**What goes wrong:** Expecting `--mount=type=cache,id=pnpm,target=/pnpm/store` to be preserved between GHA runs.
**Why it happens:** BuildKit cache mounts are separate from Docker layer cache. GHA cache backend (`type=gha`) preserves layer cache, not cache mounts.
**How to avoid:** Accept that pnpm store cache mount is local-build-only. With proper layer caching via GHA, the `pnpm install --frozen-lockfile` layer is cached when `pnpm-lock.yaml` hasn't changed, which is the same net effect.
**Warning signs:** pnpm install runs every time despite no lock file changes -- this would indicate layer cache isn't working.

### Pitfall 4: metadata-action SHA Tag Format
**What goes wrong:** SHA tags don't match expected format (e.g., `sha-abc1234` instead of `abc1234`).
**Why it happens:** Default `type=sha` generates `sha-<7chars>` format.
**How to avoid:** Use `type=sha,prefix=` for main branch (produces `abc1234`) and `type=sha,prefix=dev-` for dev branch (produces `dev-abc1234`).
**Warning signs:** Tags in GHCR don't match expected naming convention from CONTEXT.md.

### Pitfall 5: First-Time GHCR Package Visibility
**What goes wrong:** Pushed images are private by default even for public repos.
**Why it happens:** GHCR packages inherit repo visibility only when first created via GITHUB_TOKEN workflow.
**How to avoid:** For a public repo, the first push via GITHUB_TOKEN auto-links the package to the repo and inherits visibility. Verify after first successful push.
**Warning signs:** `docker pull` fails from anonymous context despite public repo.

## Code Examples

### Complete Workflow File
```yaml
# Source: Docker official docs, verified patterns from search results
name: Docker Build & Push

on:
  push:
    branches: [dev, main]

concurrency:
  group: docker-${{ github.ref }}
  cancel-in-progress: true

jobs:
  build-and-push:
    name: Build ${{ matrix.service }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        service: [gateway, auth, sender, parser, audience, notifier]
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v4

      - uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - uses: docker/metadata-action@v6
        id: meta
        with:
          images: ghcr.io/${{ github.repository_owner }}/email-platform-${{ matrix.service }}
          tags: |
            type=sha,prefix=dev-,enable=${{ github.ref == 'refs/heads/dev' }}
            type=raw,value=dev-latest,enable=${{ github.ref == 'refs/heads/dev' }}
            type=sha,prefix=,enable=${{ github.ref == 'refs/heads/main' }}
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - uses: docker/build-push-action@v7
        with:
          context: .
          file: infra/docker/app.Dockerfile
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          build-args: APP_NAME=${{ matrix.service }}
          cache-from: type=gha,scope=${{ matrix.service }}
          cache-to: type=gha,mode=max,scope=${{ matrix.service }}
```

### metadata-action SHA Tag Behavior
```
# On push to dev branch (commit abc1234567):
# type=sha,prefix=dev-  -->  dev-abc1234
# type=raw,value=dev-latest  -->  dev-latest

# On push to main branch (commit abc1234567):
# type=sha,prefix=  -->  abc1234
# type=raw,value=latest  -->  latest
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker/build-push-action@v5 | docker/build-push-action@v7 | 2026 | v7 is latest major, v5/v6 still work |
| docker/setup-buildx-action@v3 | docker/setup-buildx-action@v4 | 2025 | v4 supports GHA cache API v2 |
| docker/login-action@v3 | docker/login-action@v4 | 2026 | Minor updates, same interface |
| GHA Cache API v1 | GHA Cache API v2 | April 2025 | v1 sunset, must use buildx >= 0.21.0 or setup-buildx-action@v4 |

**Deprecated/outdated:**
- GHA Cache API v1: Sunset April 15, 2025. Using `docker/setup-buildx-action@v4` ensures v2 compatibility automatically.
- `docker/build-push-action@v5`: Works but missing v7 improvements.

## Open Questions

1. **metadata-action `type=sha` default length**
   - What we know: Default produces 7-char SHA, which matches D-04 requirement (`<sha7>`).
   - What's unclear: Whether `type=sha` prefix behavior differs between v5 and v6 of metadata-action.
   - Recommendation: Test first push and verify tag format. If `sha-` prefix appears unwanted, use `type=sha,prefix=` explicitly.

2. **GHA cache 10GB repository limit**
   - What we know: GitHub Actions cache has a 10GB per-repo limit across all caches.
   - What's unclear: Whether 6 services x max-mode cache fits within 10GB long-term.
   - Recommendation: Monitor cache usage after first few runs. If limit is hit, consider switching to `mode=min` or `type=registry` cache.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual validation (no automated test framework for GHA workflows) |
| Config file | `.github/workflows/docker-build.yml` |
| Quick run command | Push to dev branch and monitor Actions tab |
| Full suite command | Push to main branch and verify `docker pull` + `docker run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DBLD-01 | 6 services build in parallel via matrix | manual | Push to dev, check Actions: 6 parallel jobs | N/A |
| DBLD-02 | Images published to GHCR with correct tags | manual | `docker pull ghcr.io/zerouser-cloud/email-platform-gateway:dev-latest` | N/A |
| DBLD-03 | Scoped cache per service | manual | Push twice, verify second build has cache hits in logs | N/A |

### Sampling Rate
- **Per task commit:** Lint YAML with `actionlint` if available, otherwise visual review
- **Per wave merge:** Push to dev, verify all 6 images appear in GHCR
- **Phase gate:** Pull and run at least one image: `docker pull ... && docker run --rm -e ... <image>`

### Wave 0 Gaps
- None -- this phase creates a new workflow file, no test infrastructure needed.

## Project Constraints (from CLAUDE.md)

- **No infrastructure changes without approval:** Workflow file is new (not modifying existing infra), but any changes to Dockerfile or docker-compose require approval per infrastructure-guard skill.
- **No environment branching in app code:** Workflow uses branch refs for tagging (GHA level), not app code -- compliant with 12-Factor.
- **Tech stack unchanged:** No new runtime dependencies. Docker actions are CI-only.
- **No business logic:** This phase is pure CI/CD infrastructure.

## Sources

### Primary (HIGH confidence)
- [Docker official docs: GHA cache](https://docs.docker.com/build/cache/backends/gha/) - scope parameter, mode=max, API v2 requirement
- [Docker official docs: Cache management with GHA](https://docs.docker.com/build/ci/github-actions/cache/) - build-push-action@v7 example, cache-dance reference
- [GitHub Docs: GHCR permissions](https://docs.github.com/en/packages/learn-github-packages/about-permissions-for-github-packages) - GITHUB_TOKEN packages:write
- Existing `infra/docker/app.Dockerfile` - verified ARG APP_NAME, multi-stage build, pnpm deploy
- Existing `.github/workflows/ci.yml` - verified GHA patterns used in project

### Secondary (MEDIUM confidence)
- [docker/build-push-action releases](https://github.com/docker/build-push-action/releases) - v7 as latest major
- [docker/build-push-action#546](https://github.com/docker/build-push-action/issues/546) - matrix cache scoping confirmed
- [reproducible-containers/buildkit-cache-dance](https://github.com/reproducible-containers/buildkit-cache-dance) - cache mount preservation (not needed for this phase)

### Tertiary (LOW confidence)
- [Web search: docker/metadata-action@v6](https://github.com/docker/metadata-action) - v6 as latest major (needs verification on first use)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Docker actions, well-documented, verified versions
- Architecture: HIGH - Single workflow file, straightforward matrix pattern, all decisions locked
- Pitfalls: HIGH - GHA cache scoping is well-documented, GITHUB_TOKEN permissions are standard

**Research date:** 2026-04-04
**Valid until:** 2026-05-04 (stable domain, action major versions change infrequently)
