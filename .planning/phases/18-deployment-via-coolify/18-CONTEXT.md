# Phase 18: Deployment via Coolify - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deploy email platform on VPS via Coolify. All infrastructure as Coolify-managed resources. Auto-deploy from GitHub. HTTPS via Traefik. Rename MINIO_* env vars to STORAGE_* for storage-agnostic naming. Create production compose file with `image:` instead of `build:`.

</domain>

<decisions>
## Implementation Decisions

### Coolify Project Structure
- **D-01:** One Coolify project "Email Platform" with two environments: dev and production.
- **D-02:** Each environment has its own set of resources: PostgreSQL (native DB), Redis (native DB), RabbitMQ (one-click Service), Garage (one-click Service for S3-compatible storage), and the application (Docker Compose resource).

### Application Deployment
- **D-03:** Deploy all 6 services as a single Docker Compose resource in Coolify. Create `docker-compose.prod.yml` with `image:` pointing to GHCR images (no `build:` on server).
- **D-04:** Auto-deploy: dev branch push → dev environment, main branch push → production environment. Coolify watches GitHub webhooks.
- **D-05:** Env vars in Coolify environment settings point to Coolify-managed infrastructure (DATABASE_URL with Coolify PostgreSQL hostname, REDIS_URL with Coolify Redis hostname, etc.).

### Env Vars Rename (MINIO → STORAGE)
- **D-06:** Rename env vars: `MINIO_ENDPOINT` → `STORAGE_ENDPOINT`, `MINIO_PORT` → `STORAGE_PORT`, `MINIO_ACCESS_KEY` → `STORAGE_ACCESS_KEY`, `MINIO_SECRET_KEY` → `STORAGE_SECRET_KEY`. Add `STORAGE_BUCKET` and `STORAGE_REGION`.
- **D-07:** Update `packages/config/src/infrastructure.ts` Zod schema with new names.
- **D-08:** Update all `.env` files (.env, .env.docker, .env.example) with new names. Local dev still uses MinIO, but with STORAGE_* variable names.

### DNS & Domains
- **D-09:** Prod API gateway: `api.email-platform.pp.ua` → Coolify production gateway service.
- **D-10:** Dev API gateway: `api.dev.email-platform.pp.ua` → Coolify dev gateway service.
- **D-11:** Root `email-platform.pp.ua` and `dev.email-platform.pp.ua` reserved for future frontend. Not used by API.
- **D-12:** Traefik (via Coolify) handles auto-TLS for all domains.

### Infrastructure Resources in Coolify
- **D-13:** PostgreSQL — Coolify native Database resource. Separate instance per environment.
- **D-14:** Redis — Coolify native Database resource. Separate instance per environment.
- **D-15:** RabbitMQ — Coolify one-click Service. Separate instance per environment.
- **D-16:** Garage — Coolify one-click Service (S3-compatible storage). Replaces MinIO on server. Separate instance per environment.

### Claude's Discretion
- Exact docker-compose.prod.yml structure (networks, healthchecks)
- Coolify webhook configuration details
- Resource limits and restart policies for Coolify resources
- Whether to add Coolify admin subdomain (e.g., coolify.email-platform.pp.ua)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docker & deployment
- `infra/docker/app.Dockerfile` — Multi-stage Dockerfile, ARG APP_NAME, pnpm deploy
- `infra/docker-compose.yml` — Current full-stack compose (reference for service structure, NOT for production use)
- `.github/workflows/docker-build.yml` — GHCR push workflow (image naming: ghcr.io/zerouser-cloud/email-platform-<service>)

### Config & env schema
- `packages/config/src/infrastructure.ts` — Zod schema with MINIO_* vars to rename
- `packages/config/src/env-schema.ts` — Global env schema
- `.env` — Local dev env vars
- `.env.docker` — Docker Compose env vars
- `.env.example` — Template (tracked in git)

### Skills
- `.agents/skills/infrastructure-guard/SKILL.md` — Port and infra change protocol
- `.agents/skills/twelve-factor/SKILL.md` — No env branching, config from env
- `.agents/skills/env-schema/SKILL.md` — No defaults, no optionals, no z.coerce.boolean()

### Coolify docs
- Coolify Docker Compose build pack: https://coolify.io/docs/applications/build-packs/docker-compose
- Coolify services (Garage, RabbitMQ): https://coolify.io/docs/services/all

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `infra/docker-compose.yml` — Service structure (gateway, auth, sender, parser, audience, notifier) with depends_on, healthchecks, networks. Production compose will mirror this with `image:` instead of `build:`.
- `.github/workflows/docker-build.yml` — Already pushes images to GHCR with branch-aware tags (dev-latest, latest).
- `packages/config/src/catalog/services.ts` — Service catalog with port definitions.

### Established Patterns
- Docker Compose services use `env_file` for configuration
- Healthchecks on all services via wget to /health/live
- Networks: `services` (inter-service gRPC) + `infra` (service-to-infra)
- Gateway is the only externally accessible service (port 4000:3000)

### Integration Points
- `packages/config/src/infrastructure.ts` — MINIO_* fields need renaming to STORAGE_*
- `.env`, `.env.docker`, `.env.example` — Need STORAGE_* vars
- Coolify env vars configuration — replaces .env.docker for server deployment

</code_context>

<specifics>
## Specific Ideas

- Coolify уже установлен на VPS (v4.0.0-beta.442)
- DNS уже настроен: api.email-platform.pp.ua и api.dev.email-platform.pp.ua → 135.181.41.169
- GitHub repo: zerouser-cloud/email-platform-services (public, branches dev + main with protection)
- Локально MinIO остаётся в docker-compose.infra.yml, на сервере Garage через Coolify
- Приложение не знает разницы — одни и те же STORAGE_* env vars

</specifics>

<deferred>
## Deferred Ideas

- Frontend deployment на email-platform.pp.ua / dev.email-platform.pp.ua — отдельный проект
- Coolify admin на отдельном поддомене — можно настроить позже
- Мониторинг и алертинг — следующий milestone
- Миграция RabbitMQ → Redis Streams — будущий milestone

</deferred>

---

*Phase: 18-deployment-via-coolify*
*Context gathered: 2026-04-05*
