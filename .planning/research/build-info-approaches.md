# Build/Deploy Metadata in NestJS Containers

**Date:** 2026-04-08
**Goal:** Embed commit hash, branch, build time into running containers for `/health/live`

## Current State

- `docker/metadata-action@v6` already sets OCI labels including `org.opencontainers.image.revision` (full SHA) [VERIFIED: docker-build.yml line 33-40, docker/metadata-action docs]
- `docker/build-push-action@v7` already passes `labels: ${{ steps.meta.outputs.labels }}` [VERIFIED: docker-build.yml line 48]
- Gateway liveness already reads `process.env.COOLIFY_BRANCH` [VERIFIED: apps/gateway/src/health/health.controller.ts line 48]
- Coolify injects `SOURCE_COMMIT` and `COOLIFY_BRANCH` into containers [VERIFIED: coolify.io/docs/knowledge-base/environment-variables]

## Approach Analysis

### 1. Docker Image Labels (org.opencontainers.image.revision)

**Already happening.** The CI pipeline sets these via `metadata-action`. However, **labels cannot be read from inside the container** -- they are image manifest metadata accessible only via `docker inspect` or registry API. A running Node.js process has no way to read its own image labels.

**Verdict: Not usable at runtime.** Useful for external tooling (registry browsing, Coolify UI) but not for `/health/live`.

### 2. Build-Time File Generation (RECOMMENDED)

Generate `build-info.json` during Docker build. The app reads it at startup via `fs.readFileSync`.

**Implementation:**

```dockerfile
# In app.Dockerfile, after Step 5 (deploy), before Stage 2:
ARG COMMIT_SHA=unknown
ARG COMMIT_BRANCH=unknown
ARG BUILD_TIME=unknown

RUN echo "{\"commitSha\":\"${COMMIT_SHA}\",\"branch\":\"${COMMIT_BRANCH}\",\"buildTime\":\"${BUILD_TIME}\"}" > /prod/app/build-info.json
```

```yaml
# In docker-build.yml, build-push-action:
build-args: |
  APP_NAME=${{ matrix.service }}
  COMMIT_SHA=${{ github.sha }}
  COMMIT_BRANCH=${{ github.ref_name }}
  BUILD_TIME=${{ github.event.head_commit.timestamp }}
```

```typescript
// In app code:
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const BUILD_INFO_PATH = join(__dirname, '..', 'build-info.json');

const loadBuildInfo = () => {
  if (existsSync(BUILD_INFO_PATH)) {
    return JSON.parse(readFileSync(BUILD_INFO_PATH, 'utf-8'));
  }
  return { commitSha: 'local', branch: 'local', buildTime: 'unknown' };
};
```

**Pros:**
- No env vars needed
- Works everywhere: local dev returns `local`, Docker returns real values
- Baked into the image -- immutable, always matches the code
- Short SHA can be derived at read time: `sha.slice(0, 7)`

**Cons:**
- Extra build arg in Dockerfile (trivial)
- File must be included in `pnpm deploy` output or copied separately

**Cache impact:** `COMMIT_SHA` changes every build, so the ARG must come AFTER expensive steps. Current Dockerfile structure already supports this -- ARGs can be declared just before RUN that writes the file, after `pnpm deploy`.

### 3. Docker Build Args to ENV

```dockerfile
ARG COMMIT_SHA
ENV COMMIT_SHA=${COMMIT_SHA}
```

**Verdict: Works but violates "no env vars" requirement.** Technically the env var is baked into the image (not set by Coolify), but it blurs the line. Build-info file is cleaner.

### 4. package.json Version

Using `npm version` or sed to patch package.json during CI is fragile and creates dirty git state. Not recommended.

**Verdict: Avoid.**

### 5. Coolify Auto-Injected Variables

Coolify injects these automatically [VERIFIED: coolify.io/docs]:
- `SOURCE_COMMIT` -- commit hash (excluded from Docker builds by default; must enable "Include Source Commit in Build" in Coolify settings)
- `COOLIFY_BRANCH` -- branch name

**Critical nuance for THIS project:** Coolify is NOT building images. CI builds images and pushes to GHCR. Coolify only pulls and redeploys. In this mode:
- `COOLIFY_BRANCH` reflects the Coolify-configured branch, not necessarily the one that built the image
- `SOURCE_COMMIT` may reflect Coolify's last known commit, not the image's actual commit

**Verdict: Unreliable.** The commit in `SOURCE_COMMIT` might not match the actual code in the Docker image. A baked-in file is the single source of truth.

### 6. Git Inside Docker Build

`.git` directory is NOT copied into the Docker build context (no COPY .git in Dockerfile, and it shouldn't be -- it's large). Running `git rev-parse HEAD` inside Docker build is not possible without copying `.git`.

**Verdict: Bad practice.** Use CI-provided `github.sha` via build args instead.

## Recommendation

**Use Approach 2: Build-time file generation via build args.**

Steps:
1. Add `ARG COMMIT_SHA`, `ARG COMMIT_BRANCH`, `ARG BUILD_TIME` to Dockerfile (after expensive build steps)
2. Write `build-info.json` to `/prod/app/` in builder stage
3. Pass args from CI: `github.sha`, `github.ref_name`, timestamp
4. Create a `BuildInfoModule` or simple loader in `packages/foundation` that reads the file once at startup
5. Inject build info into health controller responses
6. For local dev, file doesn't exist -- fallback to `{ commitSha: 'local', branch: 'local' }`

### Dockerfile Change (Minimal)

```dockerfile
# After Step 5 (pnpm deploy), before proto copy:
ARG COMMIT_SHA=local
ARG COMMIT_BRANCH=local  
ARG BUILD_TIME=unknown
RUN printf '{"commitSha":"%s","branch":"%s","buildTime":"%s"}' \
    "$COMMIT_SHA" "$COMMIT_BRANCH" "$BUILD_TIME" > /prod/app/build-info.json
```

### CI Change (docker-build.yml)

```yaml
build-args: |
  APP_NAME=${{ matrix.service }}
  COMMIT_SHA=${{ github.sha }}
  COMMIT_BRANCH=${{ github.ref_name }}
  BUILD_TIME=${{ steps.meta.outputs.created }}
```

Note: `steps.meta.outputs.created` gives ISO 8601 timestamp from metadata-action. Alternatively use a separate step with `date -u +"%Y-%m-%dT%H:%M:%SZ"`.

### Health Response Shape

```json
{
  "status": "ok",
  "build": {
    "commit": "a1b2c3d",
    "branch": "main",
    "buildTime": "2026-04-08T12:00:00Z"
  }
}
```

## Docker Layer Cache Consideration

Build args that change every commit (COMMIT_SHA) invalidate all subsequent layers. Place the `build-info.json` generation as the LAST step in the builder stage, after all expensive operations (pnpm install, build, deploy). The current Dockerfile already has the right structure for this -- insert after Step 6 (proto copy).

## Cleanup: Remove COOLIFY_BRANCH Usage

Current `health.controller.ts` line 48 uses `process.env.COOLIFY_BRANCH`. This should be replaced with the file-based approach since:
1. It only works in Coolify (not local Docker)
2. It's a runtime env var, not baked into the image
3. The `?? 'local'` fallback pattern violates env-schema conventions (no fallbacks in consumer code)
