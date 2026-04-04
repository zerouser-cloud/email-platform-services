# Architecture: Infrastructure, CI/CD & Deployment

**Domain:** Docker-compose split strategy, CI pipeline, deployment without Kubernetes
**Researched:** 2026-04-04
**Overall confidence:** HIGH

## 1. Docker-Compose Split Strategy

### Recommended: Three-File Architecture with `include`

Split the monolithic `docker-compose.yml` into three files using Docker Compose `include` directive (stable since Compose V2.20+, the modern replacement for `-f` merge).

```
infra/
  docker-compose.yml              # Full stack: includes infra, adds 6 app services (builds from source)
  docker-compose.infra.yml        # Infrastructure only: postgres, redis, rabbitmq, minio
  docker-compose.prod.yml         # Production: includes infra, uses pre-built images from registry
  docker/
    app.Dockerfile                # Unchanged -- already correct multi-stage build
```

### File 1: `docker-compose.infra.yml` -- Infrastructure Only

Standalone valid compose file for the 4 backing services. Used in two contexts:
- **Direct:** `docker compose -f infra/docker-compose.infra.yml up -d` for local dev
- **Included:** By `docker-compose.yml` and `docker-compose.prod.yml`

**Critical fix from current state:** redis, rabbitmq, and minio currently have NO `ports:` mapping, only `networks: [infra]`. This means host-run NestJS services cannot reach them. The infra file must expose ports to host:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]               # HARDCODED, not ${POSTGRES_PORT}
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-email_platform}
    volumes: [postgres_data:/var/lib/postgresql/data]
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [infra]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]               # NEW: enables local dev access
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    networks: [infra]

  rabbitmq:
    image: rabbitmq:3-management
    ports: ["5672:5672", "15672:15672"] # NEW: 5672 for AMQP, 15672 for management UI
    volumes: [rabbitmq_data:/var/lib/rabbitmq]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "rabbitmq-diagnostics", "-q", "check_running"]
      interval: 10s
      timeout: 10s
      retries: 5
      start_period: 30s
    networks: [infra]

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports: ["9000:9000", "9001:9001"]  # NEW: 9000 for API, 9001 for console
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes: [minio_data:/data]
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "mc", "ready", "local"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [infra]

volumes:
  postgres_data:
  rabbitmq_data:
  minio_data:

networks:
  infra:
    driver: bridge
```

### File 2: `docker-compose.yml` -- Full Stack (Development)

For running the entire platform in Docker. Includes infra, adds all 6 app services built from source.

```yaml
include:
  - docker-compose.infra.yml

services:
  gateway:
    build:
      context: ../
      dockerfile: infra/docker/app.Dockerfile
      args: { APP_NAME: gateway }
    ports: ["4000:3000"]
    env_file: ../.env.docker
    depends_on:
      auth: { condition: service_healthy }
      sender: { condition: service_healthy }
      parser: { condition: service_healthy }
      audience: { condition: service_healthy }
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3000/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [services]           # Gateway only talks to app services

  auth:
    build:
      context: ../
      dockerfile: infra/docker/app.Dockerfile
      args: { APP_NAME: auth }
    expose: ["3001", "50051"]
    env_file: ../.env.docker
    depends_on:
      postgres: { condition: service_healthy }
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3001/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [services, infra]    # Both networks: talks to gateway + postgres

  # sender, parser, audience, notifier follow the same pattern
  # with appropriate depends_on for their infra dependencies

networks:
  services:
    driver: bridge
```

**The `include` directive** imports `docker-compose.infra.yml` as a dependency. The infra network and volumes become available to app services. No `-f` flag gymnastics needed -- just `docker compose up`.

### File 3: `docker-compose.prod.yml` -- Production

Same structure but pulls pre-built images from container registry instead of building. Resource limits added.

```yaml
include:
  - docker-compose.infra.yml

services:
  gateway:
    image: ghcr.io/${GITHUB_REPOSITORY}/gateway:${IMAGE_TAG:-latest}
    ports: ["4000:3000"]
    deploy:
      resources:
        limits: { memory: 256M, cpus: "0.5" }
    restart: unless-stopped
    init: true
    healthcheck:
      test: ["CMD", "wget", "-qO/dev/null", "http://127.0.0.1:3000/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    networks: [services]
  # ... other services with image: instead of build:
```

### POSTGRES_PORT Variable -- Remove It

The milestone context flags `POSTGRES_PORT` as incorrectly added. **Hardcode `5432:5432`.** Rationale:
- 5432 is the PostgreSQL standard port. Deviating creates confusion.
- If a developer has port 5432 occupied, use `docker-compose.override.yml` (already gitignored).
- Follows 12-Factor: conventions over configuration for local development.

### Two Development Modes

| Mode | Command | Docker runs | Host runs | Primary use |
|------|---------|------------|-----------|-------------|
| **Local dev** | `pnpm infra:up` + `pnpm dev` | postgres, redis, rabbitmq, minio | All 6 NestJS services via ts-node-dev | Daily development |
| **Full Docker** | `pnpm docker:up` | All 10 containers | Nothing | Integration testing, CI |

**Local dev is primary** because:
- Hot-reload via ts-node-dev is instant (no Docker build cycle)
- Native Node.js debugging (attach inspector directly)
- Turbo build caching works on host
- Only stateful backing services need Docker

### Package.json Scripts

```json
{
  "infra:up": "docker compose -f infra/docker-compose.infra.yml up -d",
  "infra:down": "docker compose -f infra/docker-compose.infra.yml down",
  "infra:reset": "docker compose -f infra/docker-compose.infra.yml down -v && docker compose -f infra/docker-compose.infra.yml up -d",
  "docker:up": "docker compose -f infra/docker-compose.yml up --build",
  "docker:down": "docker compose -f infra/docker-compose.yml down"
}
```

## 2. Environment File Strategy

### Current State Problems

1. `.env` and `.env.docker` duplicate ~90% of content with only hostname differences
2. `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` in `.env.docker` are consumed only by postgres container, not NestJS apps
3. `.env.docker` sets `NODE_ENV=development` which contradicts Dockerfile's `NODE_ENV=production`
4. No `PROTO_DIR` in `.env` (local dev)

### Recommended: Three-File Strategy

| File | Purpose | Git tracked |
|------|---------|-------------|
| `.env.example` | Variable catalog, documentation, safe defaults | YES |
| `.env` | Local dev (localhost hostnames, pretty logs) | NO |
| `.env.docker` | Full-Docker (container hostnames, json logs) | NO |

### What Differs Between `.env` and `.env.docker`

Only hostnames and log format differ. Everything else is identical.

| Variable | `.env` (local dev) | `.env.docker` (full Docker) |
|----------|--------------------|-----------------------------|
| `AUTH_GRPC_URL` | `0.0.0.0:50051` | `auth:50051` |
| `SENDER_GRPC_URL` | `0.0.0.0:50052` | `sender:50052` |
| `PARSER_GRPC_URL` | `0.0.0.0:50053` | `parser:50053` |
| `AUDIENCE_GRPC_URL` | `0.0.0.0:50054` | `audience:50054` |
| `DATABASE_URL` | `...@localhost:5432/...` | `...@postgres:5432/...` |
| `REDIS_URL` | `redis://localhost:6379` | `redis://redis:6379` |
| `RABBITMQ_URL` | `amqp://localhost:5672` | `amqp://rabbitmq:5672` |
| `MINIO_ENDPOINT` | `localhost` | `minio` |
| `LOG_FORMAT` | `pretty` | `json` |

### Remove NODE_ENV from .env.docker

Dockerfile sets `ENV NODE_ENV=production` for V8/Express optimizations. `.env.docker` overrides it to `development`, defeating the purpose. Remove it.

### Container-Only Variables

`POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` are consumed by the postgres container, not NestJS. Keep as defaults in `docker-compose.infra.yml`:

```yaml
environment:
  POSTGRES_USER: ${POSTGRES_USER:-postgres}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
  POSTGRES_DB: ${POSTGRES_DB:-email_platform}
```

### Add PROTO_DIR to .env

```
# .env (local dev)
PROTO_DIR=./packages/contracts/proto

# .env.docker (full Docker)
PROTO_DIR=/app/proto
```

## 3. CI/CD Pipeline Architecture

### Platform: GitHub Actions

GitHub Actions because: native to GitHub, monorepo path filtering, excellent Docker/BuildKit integration, GITHUB_TOKEN for GHCR auth, free tier covers needs.

### Workflow 1: `ci.yml` -- Validation on PRs

```yaml
name: CI
on:
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.head_ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0               # Turbo needs git history

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: Lint, typecheck, build (affected only)
        run: pnpm turbo run lint typecheck build --filter='...[origin/main]'
```

**Key decisions:**
- `fetch-depth: 0` -- Turbo needs full history for `--filter='...[origin/main]'`
- `concurrency` with `cancel-in-progress` -- new pushes cancel stale runs
- Single `turbo run` with multiple tasks -- Turbo parallelizes internally
- `--filter='...[origin/main]'` with `...` includes dependents

### Workflow 2: `deploy.yml` -- Build, Push, Deploy on main

```yaml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      matrix: ${{ steps.set-matrix.outputs.matrix }}
      has_changes: ${{ steps.set-matrix.outputs.has_changes }}
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - id: set-matrix
        run: |
          AFFECTED=$(pnpm turbo ls --affected --filter='./apps/*' 2>/dev/null \
            | grep '@email-platform/' \
            | sed 's/@email-platform\///' \
            | jq -Rc '[inputs // empty]')
          echo "matrix=$AFFECTED" >> "$GITHUB_OUTPUT"
          if [ "$AFFECTED" = "[]" ]; then
            echo "has_changes=false" >> "$GITHUB_OUTPUT"
          else
            echo "has_changes=true" >> "$GITHUB_OUTPUT"
          fi

  build-push:
    needs: detect-changes
    if: needs.detect-changes.outputs.has_changes == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    strategy:
      matrix:
        app: ${{ fromJson(needs.detect-changes.outputs.matrix) }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: infra/docker/app.Dockerfile
          build-args: APP_NAME=${{ matrix.app }}
          push: true
          tags: |
            ghcr.io/${{ github.repository }}/${{ matrix.app }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}/${{ matrix.app }}:latest
          cache-from: type=gha,scope=${{ matrix.app }}
          cache-to: type=gha,mode=max,scope=${{ matrix.app }}

  deploy:
    needs: [detect-changes, build-push]
    if: needs.detect-changes.outputs.has_changes == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          username: ${{ secrets.DEPLOY_USER }}
          key: ${{ secrets.DEPLOY_KEY }}
          script: |
            cd /opt/email-platform
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d
```

**Key decisions:**
- **Matrix per app** -- changed services build in parallel
- **GHCR** -- free, GITHUB_TOKEN auth, no rate limits
- **Scoped GHA cache** -- `scope=${{ matrix.app }}` prevents 6 services from evicting each other in 10GB cache limit
- **Two tags** -- `sha` for rollback, `latest` for convenience
- **SSH deploy** -- simple, no extra infrastructure

### Shared Package Change Propagation

When `packages/config` or `packages/foundation` changes, Turbo marks ALL dependent apps as affected. Correct behavior -- shared packages change rarely, but when they do, all services need validation.

## 4. Deployment Architecture Without Kubernetes

### Recommended: Single VPS + Docker Compose + Caddy

For 6 microservices at pre-PMF scale, single VPS is the right choice.

```
VPS (Hetzner CX32: 4 vCPU, 8GB RAM, ~EUR 7/mo)
+----------------------------------------------------+
| systemd                                            |
|   caddy.service (reverse proxy, auto-TLS)          |
|   docker.service                                   |
|     docker compose -f docker-compose.prod.yml      |
|       gateway (port 4000)                          |
|       auth, sender, parser, audience, notifier     |
|       postgres, redis, rabbitmq, minio             |
+----------------------------------------------------+
         |
     Caddy :443 -> gateway:4000
```

### Why Caddy over Nginx

- **Automatic HTTPS** via Let's Encrypt -- zero certificate management
- **Simple config** -- 3 lines vs 30+ for Nginx with TLS
- **HTTP/2 by default**
- **Runs outside Docker** as systemd service -- survives compose restarts

```
# /etc/caddy/Caddyfile
api.example.com {
    reverse_proxy localhost:4000
}
```

### Resource Limits

| Service | Memory | CPU | Rationale |
|---------|--------|-----|-----------|
| gateway | 256M | 0.5 | Stateless proxy |
| auth | 256M | 0.5 | Simple token ops |
| sender | 512M | 1.0 | Email sending |
| parser | 512M | 1.0 | Data processing |
| audience | 256M | 0.5 | CRUD |
| notifier | 128M | 0.25 | Event consumer |
| postgres | 1G | 1.0 | Database |
| redis | 256M | 0.25 | Cache |
| rabbitmq | 512M | 0.5 | Message broker |
| minio | 256M | 0.25 | File storage |

Total: ~4GB, fits on 8GB VPS.

### Graduation Path

| Trigger | Move to | Why |
|---------|---------|-----|
| Need 2+ servers | Docker Swarm | Built into Docker, uses compose files, adds multi-host |
| Need auto-scaling | Managed containers (ECS, Fly.io, Cloud Run) | Offload infra management |
| Need canary deploys, service mesh | Kubernetes | Only when justified |

**Never skip Docker Swarm.** Same compose format, `docker stack deploy` for multi-host, zero new tooling. Compose to Swarm is 1 hour. Compose to K8s is a week.

## 5. Network Architecture

### Recommended Design

```
infra network (from docker-compose.infra.yml):
  postgres, redis, rabbitmq, minio
  + auth, sender, parser, audience, notifier (need infra access)

services network (from docker-compose.yml):
  gateway, auth, sender, parser, audience, notifier (inter-service gRPC)
```

Gateway is ONLY on `services` -- never touches infra directly. All other app services are on both networks.

### include Gotcha

When using `include`, the infra network from the included file becomes available. But verify with `docker compose config` that networks merge correctly. If they don't, use explicit `external: true` networks.

## 6. 12-Factor Compliance

| Factor | Status | Action |
|--------|--------|--------|
| I. Codebase | PASS | One repo in Git |
| II. Dependencies | PASS | pnpm lockfile |
| III. Config | FIX | Remove `NODE_ENV` from `.env.docker` |
| IV. Backing Services | PASS | All via URL env vars |
| V. Build/Release/Run | FIX | Need prod compose with pre-built images |
| VI. Processes | PASS | Stateless services |
| VII. Port Binding | PASS | Self-bound via env |
| VIII. Concurrency | PASS | Separate processes |
| IX. Disposability | VERIFY | Check SIGTERM handling per service |
| X. Dev/Prod Parity | FIX | Same image, different env only |
| XI. Logs | PASS | Pino to stdout |
| XII. Admin Processes | N/A | Migrations when DB is added |

## Anti-Patterns to Avoid

### 1. Single env file for everything
**Instead:** Separate files per environment, differing only in hostnames.

### 2. Building images in production compose
**Instead:** `docker-compose.prod.yml` uses `image:` with pre-built tags.

### 3. Deploying all services on every change
**Instead:** Turbo `--affected` + matrix build for changed images only.

### 4. Jumping to Kubernetes
**Instead:** Docker Compose on VPS. Graduate to Swarm when needing 2+ hosts.

### 5. Sequential service builds in CI
**Instead:** Matrix strategy builds all changed services concurrently.

## Sources

- [Docker Compose `include` directive](https://www.docker.com/blog/improve-docker-compose-modularity-with-include/) -- HIGH confidence
- [Docker: multiple compose files](https://docs.docker.com/compose/how-tos/multiple-compose-files/) -- HIGH confidence
- [Monorepo CI/CD with GitHub Actions](https://blog.logrocket.com/creating-separate-monorepo-ci-cd-pipelines-github-actions/) -- MEDIUM confidence
- [GitHub Actions monorepo guide](https://www.warpbuild.com/blog/github-actions-monorepo-guide) -- MEDIUM confidence
- [Turborepo affected detection](https://github.com/marketplace/actions/turbo-changed) -- MEDIUM confidence
- [Docker Compose production pitfalls](https://dflow.sh/blog/stop-misusing-docker-compose-in-production-what-most-teams-get-wrong) -- MEDIUM confidence
- [Microservice deployment patterns](https://semaphore.io/blog/deploy-microservices) -- MEDIUM confidence

---

*Architecture research for v3.0 Infrastructure & CI/CD: 2026-04-04*
