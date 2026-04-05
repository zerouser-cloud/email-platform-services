# Phase 18: Deployment via Coolify - Research

**Researched:** 2026-04-05
**Domain:** Docker Compose deployment via Coolify self-hosted PaaS, env var rename, production compose
**Confidence:** HIGH

## Summary

Phase 18 has two distinct work streams: (1) code changes in the repo -- renaming MINIO_* env vars to STORAGE_* and creating a production docker-compose file, and (2) manual Coolify configuration via UI -- creating project/environments, infrastructure resources, connecting GitHub, and configuring domains. The code changes are straightforward: 4 env vars renamed in one Zod schema file, three .env files updated, two new vars added (STORAGE_BUCKET, STORAGE_REGION), and a new `docker-compose.prod.yml` created with `image:` directives pointing to GHCR. The Coolify work is manual UI configuration that must be documented as step-by-step instructions.

Coolify v4 Docker Compose build pack supports deploying compose files with `image:` instead of `build:`, which is exactly what we need. Infrastructure (PostgreSQL, Redis, RabbitMQ, Garage) should be created as separate Coolify resources, and the application compose stack connects to them via the "predefined network" feature using Coolify-assigned hostnames.

**Primary recommendation:** Split into 3 plans: (1) MINIO->STORAGE env rename, (2) docker-compose.prod.yml creation, (3) Coolify manual configuration guide with step-by-step UI instructions.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** One Coolify project "Email Platform" with two environments: dev and production.
- **D-02:** Each environment has its own set of resources: PostgreSQL (native DB), Redis (native DB), RabbitMQ (one-click Service), Garage (one-click Service for S3-compatible storage), and the application (Docker Compose resource).
- **D-03:** Deploy all 6 services as a single Docker Compose resource in Coolify. Create `docker-compose.prod.yml` with `image:` pointing to GHCR images (no `build:` on server).
- **D-04:** Auto-deploy: dev branch push -> dev environment, main branch push -> production environment. Coolify watches GitHub webhooks.
- **D-05:** Env vars in Coolify environment settings point to Coolify-managed infrastructure (DATABASE_URL with Coolify PostgreSQL hostname, REDIS_URL with Coolify Redis hostname, etc.).
- **D-06:** Rename env vars: `MINIO_ENDPOINT` -> `STORAGE_ENDPOINT`, `MINIO_PORT` -> `STORAGE_PORT`, `MINIO_ACCESS_KEY` -> `STORAGE_ACCESS_KEY`, `MINIO_SECRET_KEY` -> `STORAGE_SECRET_KEY`. Add `STORAGE_BUCKET` and `STORAGE_REGION`.
- **D-07:** Update `packages/config/src/infrastructure.ts` Zod schema with new names.
- **D-08:** Update all `.env` files (.env, .env.docker, .env.example) with new names. Local dev still uses MinIO, but with STORAGE_* variable names.
- **D-09:** Prod API gateway: `api.email-platform.pp.ua` -> Coolify production gateway service.
- **D-10:** Dev API gateway: `api.dev.email-platform.pp.ua` -> Coolify dev gateway service.
- **D-11:** Root `email-platform.pp.ua` and `dev.email-platform.pp.ua` reserved for future frontend. Not used by API.
- **D-12:** Traefik (via Coolify) handles auto-TLS for all domains.
- **D-13:** PostgreSQL -- Coolify native Database resource. Separate instance per environment.
- **D-14:** Redis -- Coolify native Database resource. Separate instance per environment.
- **D-15:** RabbitMQ -- Coolify one-click Service. Separate instance per environment.
- **D-16:** Garage -- Coolify one-click Service (S3-compatible storage). Replaces MinIO on server. Separate instance per environment.

### Claude's Discretion
- Exact docker-compose.prod.yml structure (networks, healthchecks)
- Coolify webhook configuration details
- Resource limits and restart policies for Coolify resources
- Whether to add Coolify admin subdomain (e.g., coolify.email-platform.pp.ua)

### Deferred Ideas (OUT OF SCOPE)
- Frontend deployment
- Coolify admin on separate subdomain
- Monitoring and alerting
- RabbitMQ -> Redis Streams migration
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DPLY-01 | Coolify environments (dev + prod) with infrastructure: PostgreSQL, Redis (native DBs), RabbitMQ, Garage (one-click Services). GitHub repo connected, auto-deploy on push to dev/main | Coolify GitHub App setup, predefined network for cross-resource communication, one-click service availability confirmed |
| DPLY-02 | Traefik (via Coolify) routes dev.email-platform.pp.ua and email-platform.pp.ua to respective gateway services with auto-TLS | Coolify domain config with `https://` prefix triggers auto-TLS via Let's Encrypt |
| DPLY-03 | Health check verification after deploy -- /health/ready returns all services SERVING | Existing healthchecks in compose (wget to /health/live), Coolify health monitoring |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No defaults in env schemas:** Zod fields must not use `.default()` or `.optional()`. New STORAGE_BUCKET and STORAGE_REGION must be strict required fields.
- **No z.coerce.boolean():** Use `z.string().transform(v => v === 'true')` for booleans.
- **z.coerce.number() is safe:** STORAGE_PORT can use `z.coerce.number()`.
- **Env files sync:** All three (.env, .env.docker, .env.example) must have identical key sets.
- **Infrastructure guard:** Port changes, docker-compose changes, env file changes require explicit user approval. Phase 18 CONTEXT.md provides this approval via D-03, D-06, D-07, D-08.
- **12-Factor:** No environment branching. Same compose file for both environments, only env vars differ.
- **No magic values:** Use named constants. New env var names in schema should be self-documenting.

## Architecture Patterns

### Production Docker Compose Structure

The production compose file should mirror `infra/docker-compose.yml` service structure but with `image:` instead of `build:`. Key differences:

```yaml
# docker-compose.prod.yml
services:
  gateway:
    image: ghcr.io/zerouser-cloud/email-platform-gateway:${IMAGE_TAG:-latest}
    # No build: directive
    # No env_file: -- Coolify injects env vars
    # No depends_on: -- infra is separate Coolify resources
    ports: ["3000:3000"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3000/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

**Key design decisions for prod compose:**

1. **No `include:` directive** -- infrastructure is Coolify-managed resources, not part of compose
2. **No `depends_on:`** -- infra services (postgres, redis, rabbitmq, garage) are separate Coolify resources, not in this compose stack
3. **No `env_file:`** -- Coolify injects environment variables directly into containers
4. **No `networks:` block** -- Coolify manages networking; enable "Connect to Predefined Network" for cross-resource communication
5. **`${IMAGE_TAG:-latest}` variable** -- allows overriding tag; dev uses `dev-latest`, prod uses `latest`
6. **Only gateway exposes ports** -- internal services use `expose:` for inter-service gRPC; Traefik routes to gateway via Coolify domain config

### Coolify Networking Model

Coolify creates an isolated network per compose deployment (UUID-based). To connect to Coolify-managed infrastructure:

1. Enable "Connect to Predefined Network" on the Docker Compose resource
2. Reference infrastructure using Coolify-assigned hostnames (e.g., `postgres-<uuid>`)
3. The hostname for each Coolify resource is visible in its settings page

**Critical:** Do NOT define `networks:` in docker-compose.prod.yml. Coolify manages this. Defining your own networks causes "Gateway Timeout" errors.

### Coolify GitHub Integration Flow

Two deployment resources needed (one per environment), each watching a different branch:

```
GitHub push to dev  --> Coolify dev environment Docker Compose resource (branch: dev)
GitHub push to main --> Coolify prod environment Docker Compose resource (branch: main)
```

Each resource is a separate Docker Compose application in Coolify, configured with:
- Same GitHub repo (zerouser-cloud/email-platform-services)
- Different branch (dev vs main)
- Different env vars (pointing to respective environment's infra resources)
- Different domain (api.dev.email-platform.pp.ua vs api.email-platform.pp.ua)

### Env Var Rename Pattern

Current -> New:
```
MINIO_ENDPOINT  -> STORAGE_ENDPOINT
MINIO_PORT      -> STORAGE_PORT
MINIO_ACCESS_KEY -> STORAGE_ACCESS_KEY
MINIO_SECRET_KEY -> STORAGE_SECRET_KEY
(new)           -> STORAGE_BUCKET
(new)           -> STORAGE_REGION
```

Files to modify:
1. `packages/config/src/infrastructure.ts` -- Zod schema (rename 4 fields, add 2)
2. `.env` -- rename 4 values, add 2 new
3. `.env.docker` -- rename 4 values, add 2 new
4. `.env.example` -- rename 4 values, add 2 new

**Note on MINIO_ROOT_USER/MINIO_ROOT_PASSWORD in docker-compose.infra.yml:** These are MinIO container config vars (passed to the MinIO image), NOT application env vars. They stay as-is because they configure the MinIO container itself, which remains in local dev. The STORAGE_* vars are what the application uses to connect.

### Anti-Patterns to Avoid
- **Defining networks in prod compose:** Coolify manages networking. Custom networks cause connectivity failures.
- **Using `build:` in prod compose:** Server must pull pre-built images, never build.
- **Hardcoding Coolify hostnames:** Infrastructure hostnames contain UUIDs assigned by Coolify. Use env vars, never hardcode.
- **Using `env_file:` in prod compose:** Coolify injects vars. Having both causes confusion about source of truth.

## Coolify Configuration Guide

### Step 1: GitHub App Setup
1. In Coolify: Sources -> + Add -> GitHub App
2. Enter app name and GitHub org (zerouser-cloud)
3. Select webhook endpoint (Coolify server URL)
4. Click "Register now" -- redirects to GitHub
5. Grant access to email-platform-services repo
6. Coolify auto-stores App ID, Installation ID, Client ID, Client Secret, Webhook Secret

### Step 2: Create Project & Environments
1. Projects -> + Add -> Name: "Email Platform"
2. Create two environments: "dev" and "production"

### Step 3: Create Infrastructure Resources (per environment)
For each environment (dev, production):

**PostgreSQL (Native Database):**
- Type: PostgreSQL
- Version: 16
- Note the hostname (postgres-<uuid>) for DATABASE_URL

**Redis (Native Database):**
- Type: Redis
- Version: 7
- Note the hostname for REDIS_URL

**RabbitMQ (One-click Service):**
- Available in Services list
- Note the hostname for RABBITMQ_URL

**Garage (One-click Service):**
- Available in Services list under Storage category
- S3 API port: 3900 (Garage default)
- Create access key and bucket via Garage CLI after deployment
- Note hostname, access key, secret key for STORAGE_* vars

### Step 4: Create Application Resources (per environment)
1. + Add Resource -> Private Repository (with Github App)
2. Select email-platform-services repo
3. Build pack: Docker Compose
4. Compose file: `docker-compose.prod.yml`
5. Branch: `dev` for dev environment, `main` for production
6. Enable "Connect to Predefined Network"
7. Configure domain: `https://api.dev.email-platform.pp.ua` (dev) or `https://api.email-platform.pp.ua` (prod)

### Step 5: Configure Environment Variables
In each Docker Compose resource, set env vars pointing to Coolify infra:

```
# Ports (same as .env.docker)
GATEWAY_PORT=3000
AUTH_PORT=3001
SENDER_PORT=3002
PARSER_PORT=3003
AUDIENCE_PORT=3004
NOTIFIER_PORT=3005

# gRPC URLs (compose service names, same stack)
AUTH_GRPC_URL=auth:50051
SENDER_GRPC_URL=sender:50052
PARSER_GRPC_URL=parser:50053
AUDIENCE_GRPC_URL=audience:50054

# Infrastructure (Coolify resource hostnames)
DATABASE_URL=postgresql://<user>:<pass>@<postgres-uuid>:5432/email_platform
REDIS_URL=redis://<redis-uuid>:6379
RABBITMQ_URL=amqp://<rabbitmq-uuid>:5672
STORAGE_ENDPOINT=<garage-uuid>
STORAGE_PORT=3900
STORAGE_ACCESS_KEY=<garage-access-key>
STORAGE_SECRET_KEY=<garage-secret-key>
STORAGE_BUCKET=email-platform
STORAGE_REGION=garage

# Cross-cutting
LOG_LEVEL=info
LOG_FORMAT=json
CORS_ORIGINS=https://email-platform.pp.ua
CORS_STRICT=true
PROTO_DIR=/app/proto
GRPC_DEADLINE_MS=5000
RATE_LIMIT_BURST_TTL=1000
RATE_LIMIT_BURST_LIMIT=10
RATE_LIMIT_SUSTAINED_TTL=60000
RATE_LIMIT_SUSTAINED_LIMIT=100
```

### Step 6: Deploy & Verify
1. Trigger initial deploy from Coolify UI
2. Check container health: all services should show healthy
3. Test: `curl https://api.email-platform.pp.ua/health/live`
4. Test: `curl https://api.email-platform.pp.ua/health/ready`

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS certificates | Manual certbot/acme | Coolify + Traefik auto-TLS | Let's Encrypt auto-renewal, zero config |
| Reverse proxy config | Manual nginx/traefik config | Coolify domain settings | `https://` prefix auto-configures Traefik |
| Docker networking | Manual network creation | Coolify predefined networks | UUID-based isolation, automatic DNS |
| Service discovery | Manual /etc/hosts or DNS | Coolify resource hostnames | Coolify assigns and manages hostnames |
| Deployment triggers | Custom webhook handler | Coolify GitHub App | Auto-webhook setup, branch watching |

## Common Pitfalls

### Pitfall 1: Custom Networks in Prod Compose
**What goes wrong:** Defining `networks:` in docker-compose.prod.yml causes services to be unreachable -- "Gateway Timeout" errors.
**Why it happens:** Coolify creates its own network per resource. Custom networks conflict with Coolify's network management.
**How to avoid:** Do NOT define any `networks:` block in docker-compose.prod.yml. Let Coolify handle it.
**Warning signs:** 502/504 errors, services unable to reach each other.

### Pitfall 2: Forgetting Predefined Network
**What goes wrong:** App services can't reach Coolify-managed PostgreSQL/Redis/RabbitMQ/Garage.
**Why it happens:** Each Coolify resource gets its own isolated network. Without "Connect to Predefined Network", the compose stack can't see other resources.
**How to avoid:** Enable "Connect to Predefined Network" on the Docker Compose resource in Coolify settings.
**Warning signs:** Connection refused/timeout to database, redis, rabbitmq.

### Pitfall 3: Wrong Infrastructure Hostnames
**What goes wrong:** DATABASE_URL with wrong hostname causes connection failure.
**Why it happens:** Coolify-managed resources have hostnames like `postgres-<uuid>`, not just `postgres`.
**How to avoid:** Copy exact hostname from each Coolify resource's settings page.
**Warning signs:** ENOTFOUND or connection timeout in logs.

### Pitfall 4: Garage S3 Port Mismatch
**What goes wrong:** STORAGE_PORT=9000 (MinIO default) but Garage uses 3900.
**Why it happens:** MinIO uses 9000, Garage uses 3900. Different S3-compatible stores have different defaults.
**How to avoid:** Set STORAGE_PORT=3900 in Coolify env vars. Local dev keeps 9000 (MinIO).
**Warning signs:** Connection refused on storage operations.

### Pitfall 5: MINIO_ROOT_USER Confusion
**What goes wrong:** Renaming MINIO_ROOT_USER/PASSWORD in docker-compose.infra.yml breaks local MinIO.
**Why it happens:** These are MinIO container config vars, not application vars. The STORAGE_* rename only applies to application env vars.
**How to avoid:** Leave MINIO_ROOT_USER/MINIO_ROOT_PASSWORD in docker-compose.infra.yml unchanged. Only rename the application-facing MINIO_ENDPOINT/PORT/ACCESS_KEY/SECRET_KEY to STORAGE_*.

### Pitfall 6: env_file in Prod Compose
**What goes wrong:** Services read stale values from env_file, ignoring Coolify-injected vars.
**Why it happens:** If compose has `env_file:`, Docker reads from that file. Coolify injects vars separately.
**How to avoid:** Do NOT include `env_file:` in docker-compose.prod.yml. Coolify manages all env vars.

## Code Examples

### Updated Infrastructure Schema
```typescript
// packages/config/src/infrastructure.ts
import { z } from 'zod';

export const InfrastructureSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  STORAGE_ENDPOINT: z.string().min(1),
  STORAGE_PORT: z.coerce.number(),
  STORAGE_ACCESS_KEY: z.string().min(1),
  STORAGE_SECRET_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
  STORAGE_REGION: z.string().min(1),
});

export type InfrastructureConfig = z.infer<typeof InfrastructureSchema>;
```

### Production Docker Compose
```yaml
# docker-compose.prod.yml
services:
  gateway:
    image: ghcr.io/zerouser-cloud/email-platform-gateway:${IMAGE_TAG:-latest}
    ports: ["3000:3000"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3000/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  auth:
    image: ghcr.io/zerouser-cloud/email-platform-auth:${IMAGE_TAG:-latest}
    expose: ["3001", "50051"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3001/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  sender:
    image: ghcr.io/zerouser-cloud/email-platform-sender:${IMAGE_TAG:-latest}
    expose: ["3002", "50052"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3002/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  parser:
    image: ghcr.io/zerouser-cloud/email-platform-parser:${IMAGE_TAG:-latest}
    expose: ["3003", "50053"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3003/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  audience:
    image: ghcr.io/zerouser-cloud/email-platform-audience:${IMAGE_TAG:-latest}
    expose: ["3004", "50054"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3004/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s

  notifier:
    image: ghcr.io/zerouser-cloud/email-platform-notifier:${IMAGE_TAG:-latest}
    expose: ["3005"]
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3005/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
```

### GitHub Actions Deploy Step Addition
```yaml
# Addition to .github/workflows/docker-build.yml
# After all build jobs complete, trigger Coolify redeploy
  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Coolify
        run: |
          curl --request GET '${{ secrets.COOLIFY_WEBHOOK }}' \
            --header 'Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}'
```

## GHCR Image Naming

From `.github/workflows/docker-build.yml`:
- Image pattern: `ghcr.io/zerouser-cloud/email-platform-<service>`
- Tags on `dev` branch: `dev-<sha>`, `dev-latest`
- Tags on `main` branch: `<sha>`, `latest`
- Services: gateway, auth, sender, parser, audience, notifier

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MINIO_* env vars | STORAGE_* env vars (storage-agnostic) | This phase | Allows swapping MinIO for Garage without code changes |
| `build:` in compose on server | Pre-built GHCR images via `image:` | This phase | Faster deploys, single build in CI |
| Manual deployment | Coolify auto-deploy via GitHub webhooks | This phase | Push-to-deploy workflow |

## Open Questions

1. **Garage bucket/key creation timing**
   - What we know: Garage needs `garage bucket create` and `garage key create` CLI commands after initial deploy
   - What's unclear: Whether Coolify one-click Garage service auto-creates initial bucket/key or requires manual setup
   - Recommendation: Document as manual post-deploy step. User will need to `docker exec` into Garage container or use the Garage admin CLI.

2. **Coolify webhook for Docker Compose with multiple services**
   - What we know: Coolify redeployment webhook triggers a pull + restart of the entire compose stack
   - What's unclear: Whether Coolify can selectively update only changed services in a compose stack
   - Recommendation: Accept full-stack redeploy. With pre-built images, pull + restart is fast.

3. **IMAGE_TAG variable in Coolify**
   - What we know: Compose uses `${IMAGE_TAG:-latest}` for image tags
   - What's unclear: Whether Coolify passes this variable correctly to compose, or if it needs special handling
   - Recommendation: Set IMAGE_TAG as env var in Coolify. Dev environment: `IMAGE_TAG=dev-latest`, prod: `IMAGE_TAG=latest`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Coolify | All deployment | Yes (on VPS) | v4.0.0-beta.442 | -- |
| GHCR images | Docker Compose prod | Yes | -- | -- |
| GitHub repo | Auto-deploy | Yes (public) | -- | -- |
| DNS (A records) | Domain routing | Yes (pre-configured) | -- | -- |
| VPS | Everything | Yes | -- | 135.181.41.169 |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification (deployment phase) |
| Config file | N/A |
| Quick run command | `curl -s https://api.email-platform.pp.ua/health/live` |
| Full suite command | `curl -s https://api.email-platform.pp.ua/health/ready` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DPLY-01 | Coolify envs with infra + auto-deploy | manual | Verify Coolify UI + push to dev/main | N/A |
| DPLY-02 | Traefik routes domains with TLS | smoke | `curl -sI https://api.email-platform.pp.ua \| head -1` | N/A |
| DPLY-03 | Health check after deploy | smoke | `curl -s https://api.email-platform.pp.ua/health/ready` | N/A |

### Sampling Rate
- **Per task commit:** Local: `pnpm build` (verify env schema changes compile)
- **Per wave merge:** Deploy to dev env, check health
- **Phase gate:** Both dev and prod health checks pass

### Wave 0 Gaps
None -- this is a deployment phase with smoke tests, not unit tests.

## Sources

### Primary (HIGH confidence)
- [Coolify Docker Compose Build Pack](https://coolify.io/docs/applications/build-packs/docker-compose) - Build pack setup, compose file handling
- [Coolify Docker Compose Knowledge Base](https://coolify.io/docs/knowledge-base/docker/compose) - Labels, networking, env vars, predefined networks
- [Coolify Environment Variables](https://coolify.io/docs/knowledge-base/environment-variables) - Build vs runtime, shared vars, magic vars
- [Coolify Domains](https://coolify.io/docs/knowledge-base/domains) - Domain config, auto-TLS, HTTPS setup
- [Coolify GitHub App Setup](https://coolify.io/docs/applications/ci-cd/github/setup-app) - GitHub App creation, permissions
- [Coolify GitHub Auto Deploy](https://coolify.io/docs/applications/ci-cd/github/auto-deploy) - Webhook auto-deploy
- [Coolify GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions) - API-triggered redeploy
- [Coolify Services](https://coolify.io/docs/services/all) - Garage and RabbitMQ availability confirmed

### Secondary (MEDIUM confidence)
- [Coolify Predefined Networks Discussion](https://github.com/coollabsio/coolify/discussions/2925) - Cross-resource networking patterns
- [Garage Quick Start](https://garagehq.deuxfleurs.fr/documentation/quick-start/) - S3 API port 3900, bucket/key creation
- [Coolify Garage Service](https://coolify.io/docs/services/garage) - One-click service availability

### Tertiary (LOW confidence)
- Garage one-click default configuration -- exact env vars generated by Coolify template not documented, will need to inspect after deployment

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - existing codebase, well-documented Coolify features
- Architecture: HIGH - clear Coolify compose model, verified networking approach
- Pitfalls: HIGH - sourced from Coolify GitHub issues and official docs
- Coolify config steps: MEDIUM - based on docs, but UI may differ slightly in beta.442

**Research date:** 2026-04-05
**Valid until:** 2026-04-19 (Coolify beta moves fast, UI may change)
