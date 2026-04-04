# Phase 15: Docker Compose Split & Environment - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Split docker-compose into infra and full-stack files, expose infra ports for local dev, revert POSTGRES_PORT to standard 5432, sync all env files, remove NODE_ENV from env files. Two working dev modes: local (host services + Docker infra) and full Docker.

</domain>

<decisions>
## Implementation Decisions

### Compose Split (include approach)
- **D-01:** Two files: `infra/docker-compose.infra.yml` (infra only, self-contained) and `infra/docker-compose.yml` (includes infra + adds 6 services).
- **D-02:** `docker-compose.infra.yml` is self-contained — can be started independently for local dev.
- **D-03:** `docker-compose.yml` uses `include: [docker-compose.infra.yml]` directive to compose infra + services.

### Port Exposure
- **D-04:** CRITICAL FIX: Revert `${POSTGRES_PORT:-5432}:5432` to hardcoded `5432:5432` in infra compose. Standard port, no variables.
- **D-05:** Expose ALL infra ports in `docker-compose.infra.yml` for local dev:
  - PostgreSQL: `5432:5432`
  - Redis: `6379:6379`
  - RabbitMQ: `5672:5672` (AMQP) + `15672:15672` (management UI)
  - MinIO: `9000:9000` (API) + `9001:9001` (console)
- **D-06:** In full Docker mode (`docker-compose.yml`), infra ports are still exposed (inherited via include). Services communicate through Docker network.

### Environment Files
- **D-07:** Remove `NODE_ENV` from ALL env files. Dockerfile sets `NODE_ENV=production` for build optimization. App behavior driven by config values (LOG_LEVEL, CORS_ORIGINS), not environment identity. 12-Factor Factor X.
- **D-08:** Remove `PROTO_DIR` from `.env` (only relevant in Docker where proto path differs).
- **D-09:** Add missing keys to `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (needed by docker-compose.infra.yml).
- **D-10:** Sync key sets across `.env`, `.env.docker`, `.env.example`. Difference is ONLY in values (hostnames: localhost vs Docker service names, LOG_FORMAT: pretty vs json).
- **D-11:** `.env.example` tracked in git as source of truth. `.env` and `.env.docker` in .gitignore.

### Network
- **D-12:** `docker-compose.infra.yml` defines `infra` network. `docker-compose.yml` adds `services` network for inter-service communication.

### CORS Fix
- **D-13:** With NODE_ENV removed, the Zod refine check for CORS_ORIGINS wildcard needs adjustment — it currently checks `NODE_ENV === 'production'`. This must be addressed: either remove the refine (accept wildcard always in dev), or add a separate boolean flag like `CORS_STRICT=true`.

### Claude's Discretion
- Exact file paths within infra/ directory
- Whether to add convenience scripts to root package.json (e.g., `pnpm infra:up`, `pnpm docker:up`)
- Comments and documentation within compose files

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docker infrastructure
- `infra/docker-compose.yml` — Current single compose file to split
- `infra/docker/app.Dockerfile` — Dockerfile (NODE_ENV=production set here)

### Environment files
- `.env` — Local dev env (missing some keys)
- `.env.docker` — Docker Compose env (has NODE_ENV conflict)
- `.env.example` — Template (tracked in git)
- `.gitignore` — Verify .env and .env.docker are listed

### Config validation
- `packages/config/src/env-schema.ts` — Zod schema with CORS refine checking NODE_ENV
- `packages/config/src/infrastructure.ts` — DATABASE_URL schema

### Research
- `.planning/research/ARCHITECTURE.md` — Compose split patterns, env strategy
- `.planning/research/PITFALLS.md` — Env drift, compose split risks

### Skills
- `.agents/skills/infrastructure-guard/SKILL.md` — Port and infra change protocol
- `.agents/skills/twelve-factor/SKILL.md` — No env branching, config from env

</canonical_refs>

<code_context>
## Existing Code Insights

### Current Problems
- `${POSTGRES_PORT:-5432}` in compose — unauthorized variable, must revert
- Redis, RabbitMQ, MinIO have NO host port exposure — local dev broken for these
- `.env` missing POSTGRES_USER/PASSWORD/DB
- `NODE_ENV=development` in .env.docker contradicts Dockerfile
- CORS Zod refine depends on NODE_ENV

### Established Patterns
- Docker Compose services use `env_file: ../.env.docker`
- Infra services use `${VAR:-default}` pattern for env vars
- Networks: `services` (inter-service) + `infra` (service-to-infra)
- Healthchecks on all services and infra

### Integration Points
- `packages/config/src/env-schema.ts` — CORS refine check needs update when NODE_ENV removed
- `.gitignore` — may need .env.docker added
- Root package.json — optional convenience scripts

</code_context>

<specifics>
## Specific Ideas

- Each phase verifies all 6 services start and health checks pass
- Two dev commands: `docker compose -f infra/docker-compose.infra.yml up -d` (local dev) and `docker compose -f infra/docker-compose.yml up` (full Docker)
- Infrastructure-guard skill: all port changes follow standard ports table

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-docker-compose-split-environment*
*Context gathered: 2026-04-04*
