# Coolify Deploy API Behavior Research

**Researched:** 2026-04-06
**Domain:** Coolify Docker Compose deployment, API webhooks, Diun integration
**Confidence:** HIGH (verified via source code + official docs + multiple community reports)

## Summary

Coolify's deploy API triggers a full `docker compose up -d --remove-orphans --force-recreate --build` for Docker Compose stacks. This means **ALL services in the stack are stopped and recreated on every deploy**, regardless of whether their images changed. There is no per-service deploy endpoint for Compose stacks. Rolling updates and zero-downtime deployments are **not supported** for Compose-based deployments in Coolify v4.

The practical implication: when Diun detects ONE updated image and calls Coolify's deploy webhook, all 6 services experience downtime -- not just the one with the new image.

**Primary recommendation:** Split the Docker Compose stack into 6 individual "Docker Image" resources in Coolify, each with its own UUID and deploy webhook. This enables per-service deployment and rolling updates.

## Question 1: Does Coolify Redeploy ALL Services or Only Changed Ones?

**Answer: ALL services are recreated.** Confidence: HIGH.

Coolify's source code (`app/Actions/Service/StartService.php`) runs:

```bash
docker compose --project-directory {workdir} -f {workdir}/docker-compose.yml \
  --project-name {service_uuid} up -d --remove-orphans --force-recreate --build
```

The `--force-recreate` flag explicitly forces Docker to recreate ALL containers, even if their configuration and images have not changed. This is not a bug -- it is the intentional behavior in Coolify's codebase.

If `pullLatestImages` is true, Coolify first runs:
```bash
docker compose --project-directory {workdir} pull
```

This pulls ALL images in the compose file, not just changed ones.

**Source:** [Coolify StartService.php on GitHub](https://github.com/coollabsio/coolify/blob/v4.x/app/Actions/Service/StartService.php)

## Question 2: Per-Service Deploy Endpoints

**Answer: No per-service deploy for Compose stacks.** Confidence: HIGH.

The deploy API endpoint is:

```
GET /api/v1/deploy?uuid={resource_uuid}&force=false
```

Parameters:
- `uuid` -- Resource UUID(s), comma-separated list accepted
- `tag` -- Tag name(s), comma-separated
- `force` -- Boolean (see Question 3)
- `pr` -- Pull request number (cannot combine with tag)

Authentication: Bearer token via `Authorization: Bearer {token}`

Response:
```json
{
  "deployments": [
    {
      "message": "string",
      "resource_uuid": "string",
      "deployment_uuid": "string"
    }
  ]
}
```

A Docker Compose stack is a single resource with a single UUID. Calling deploy on that UUID deploys the entire stack. There is no way to target individual services within a Compose stack via the API.

**Source:** [Coolify API - Deploy by Tag or UUID](https://coolify.io/docs/api-reference/api/operations/deploy-by-tag-or-uuid)

## Question 3: force=false vs force=true

**Answer:** Confidence: MEDIUM-HIGH.

- `force=false` -- Deploys using cached build layers where possible. For pre-built images (our case), this still runs `--force-recreate` so containers ARE recreated, but Docker may use cached layers if building.
- `force=true` -- Forces a rebuild without any cache. Equivalent to `--no-cache` for build operations.

**Important nuance for pre-built images:** The `force` parameter primarily affects BUILD cache, not image pull behavior. For Docker Compose stacks using pre-built images from GHCR:
- Images are pulled based on `pull_policy` in docker-compose.yml
- Without `pull_policy: always`, Docker may NOT pull new images even with `force=true` (this was a reported bug)
- With `pull_policy: always` (which we already have), images are always re-pulled

**Known bug (resolved via workaround):** Issue #5318 reported that `force=true` webhook did not pull latest images. The fix was adding `pull_policy: always` to docker-compose.yml, which we already do.

**Sources:**
- [Bug #5318: webhook with force=true doesn't pull latest image](https://github.com/coollabsio/coolify/issues/5318)
- [Coolify API docs](https://coolify.io/docs/api-reference/api/operations/deploy-by-tag-or-uuid)

## Question 4: Deploying Only Changed Images

**Answer: Not possible with Docker Compose stacks in Coolify.** Confidence: HIGH.

Coolify always runs `--force-recreate` on the entire stack. There is no:
- Selective service deployment within a Compose stack
- Image-change detection that skips unchanged services
- Partial redeploy capability

### Workaround: Split Into Individual Resources

The officially recommended approach from Coolify team:

> "For compose based deployments, all containers are stopped before starting the new ones, there is no rolling update for compose based deployments currently. As a workaround you can split your compose up into individual services to get rolling updates."

Each service would be a separate "Docker Image" resource in Coolify with:
- Its own UUID
- Its own deploy webhook URL
- Independent deployment lifecycle
- Rolling update support (with health checks)

**Source:** [Zero-Downtime deployment discussion](https://github.com/coollabsio/coolify/discussions/3767)

## Downtime Behavior for Unchanged Services

**Answer: YES, unchanged services experience downtime.** Confidence: HIGH.

When Coolify deploys a Docker Compose stack:

1. `docker compose pull` runs -- pulls ALL images (with `pull_policy: always`)
2. `docker compose up -d --force-recreate` runs -- stops and recreates ALL containers
3. All 6 services go down simultaneously
4. All 6 services start back up
5. Estimated downtime: ~10-30 seconds depending on startup time

From the Coolify docs on rolling updates:
> "Rolling updates are not supported on Docker Compose-based deployments. Docker Compose deployments use static container names, which can prevent the rolling update from executing as expected."

This means even services whose images did NOT change will be stopped, destroyed, and recreated from the same image.

**Sources:**
- [Rolling Updates docs](https://coolify.io/docs/knowledge-base/rolling-updates)
- [Rolling update discussion #2824](https://github.com/coollabsio/coolify/discussions/2824)

## Diun + Coolify Integration Implications

Current setup: Diun watches 6 GHCR images, calls Coolify webhook when ANY image updates.

**Problem chain:**
1. CI builds and pushes ONE updated service image to GHCR
2. Diun detects the new image tag
3. Diun calls `GET /api/v1/deploy?uuid={stack_uuid}&force=false`
4. Coolify runs `docker compose pull` (pulls all 6 images)
5. Coolify runs `docker compose up -d --force-recreate` (recreates all 6 containers)
6. All 6 services experience downtime, even though only 1 image changed

**Additional problem:** If multiple images update within a short window (e.g., CI builds 3 services), Diun may trigger 3 separate webhook calls, causing 3 full stack redeploys in rapid succession.

## Recommended Architecture

### Option A: Split Into Individual Coolify Resources (Recommended)

Deploy each service as a separate "Docker Image" resource in Coolify:

```
gateway     -> Coolify Resource UUID: uuid-gw    -> webhook: /api/v1/deploy?uuid=uuid-gw
auth        -> Coolify Resource UUID: uuid-auth  -> webhook: /api/v1/deploy?uuid=uuid-auth
sender      -> Coolify Resource UUID: uuid-send  -> webhook: /api/v1/deploy?uuid=uuid-send
parser      -> Coolify Resource UUID: uuid-pars  -> webhook: /api/v1/deploy?uuid=uuid-pars
audience    -> Coolify Resource UUID: uuid-aud   -> webhook: /api/v1/deploy?uuid=uuid-aud
notifier    -> Coolify Resource UUID: uuid-not   -> webhook: /api/v1/deploy?uuid=uuid-not
```

Infrastructure (PostgreSQL, Redis, RabbitMQ, MinIO) stays as a separate Compose stack since those images rarely change.

**Pros:**
- Per-service deployment (only changed service redeploys)
- Rolling updates supported (zero-downtime with health checks)
- Diun can call per-service webhook
- Independent scaling

**Cons:**
- More resources to manage in Coolify UI (6 instead of 1)
- Shared networking must be configured manually (custom Docker network)
- Service discovery changes (must use network aliases or fixed container names)
- More complex initial setup

### Option B: Keep Compose, Accept Full Redeploy

Keep current architecture but accept that every deploy recreates all services.

**Pros:**
- Simple, single-resource management
- Service discovery via compose service names works automatically
- Current setup already works

**Cons:**
- All services experience downtime on every deploy
- Wasted time pulling/recreating unchanged images
- No rolling updates possible (Coolify v4 limitation)

### Option C: Hybrid -- Services Compose + App Compose

Split into two Compose stacks:
1. Infrastructure stack (postgres, redis, rabbitmq, minio) -- rarely deployed
2. Application stack (6 microservices) -- frequently deployed

Still has the same all-or-nothing redeploy problem for the app stack, but at least infrastructure stays stable.

### Option D: Custom Deploy Script Bypassing Coolify

Use a custom script that SSHes into the server and runs targeted docker compose commands:

```bash
# Pull only the changed service
docker compose pull gateway
# Recreate only the changed service (no --force-recreate for others)
docker compose up -d --no-deps gateway
```

The `--no-deps` flag prevents Docker from recreating dependent services.

**Pros:**
- Surgical per-service deployment
- Minimal downtime (only affected service)
- No Coolify architecture changes needed

**Cons:**
- Bypasses Coolify's deployment tracking and UI
- Must manage SSH access and deployment logic
- Coolify won't show accurate deployment status
- Loses Coolify's rollback capabilities

## Summary Table

| Approach | Per-Service Deploy | Zero Downtime | Coolify Tracking | Complexity |
|----------|-------------------|---------------|------------------|------------|
| A: Individual Resources | Yes | Yes (with health checks) | Full | High initial setup |
| B: Keep Compose | No | No | Full | None (current) |
| C: Hybrid Compose | No (per app stack) | No | Full | Low |
| D: Custom Script | Yes | Partial | Lost | Medium |

## Sources

### Primary (HIGH confidence)
- [Coolify StartService.php source code](https://github.com/coollabsio/coolify/blob/v4.x/app/Actions/Service/StartService.php) -- confirmed `--force-recreate` flag
- [Coolify Rolling Updates docs](https://coolify.io/docs/knowledge-base/rolling-updates) -- confirmed no rolling updates for Compose
- [Coolify Deploy API docs](https://coolify.io/docs/api-reference/api/operations/deploy-by-tag-or-uuid) -- confirmed endpoint parameters

### Secondary (MEDIUM-HIGH confidence)
- [Zero-Downtime discussion #3767](https://github.com/coollabsio/coolify/discussions/3767) -- team confirmed Compose limitation, suggested splitting
- [Rolling update discussion #2824](https://github.com/coollabsio/coolify/discussions/2824) -- community confirmed behavior
- [Bug #5318: force=true image pull](https://github.com/coollabsio/coolify/issues/5318) -- confirmed pull_policy workaround
- [Restart vs Redeploy discussion #2935](https://github.com/coollabsio/coolify/discussions/2935) -- clarified difference
- [DeepWiki: Services and Docker Compose](https://deepwiki.com/coollabsio/coolify/4.4-services-and-docker-compose) -- additional code analysis
- [Bug #7084: Compose not updating images](https://github.com/coollabsio/coolify/issues/7084) -- confirmed image update issues
