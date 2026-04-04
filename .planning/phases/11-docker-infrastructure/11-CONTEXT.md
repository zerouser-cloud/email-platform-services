# Phase 11: Docker Infrastructure - Context

**Gathered:** 2026-04-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace MongoDB with PostgreSQL 16 in docker-compose. Update service dependencies, volumes, env files. All 6 services must start and health checks must pass with the new infrastructure.

</domain>

<decisions>
## Implementation Decisions

### PostgreSQL Service
- **D-01:** Replace `mongodb` service with `postgres` service using `postgres:16-alpine` image. Healthcheck via `pg_isready -U $POSTGRES_USER`.
- **D-02:** Volume: `postgres_data:/var/lib/postgresql/data`. Remove `mongo_data` volume.
- **D-03:** Environment: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` from env vars (matching DATABASE_URL).

### Service Dependencies
- **D-04:** Replace `depends_on: mongodb` with `depends_on: postgres` for auth, sender, parser, audience. Keep other dependencies (redis, rabbitmq, minio) as-is.
- **D-05:** Gateway depends on services only (no database dependency) — unchanged.
- **D-06:** Notifier depends on rabbitmq + minio only — unchanged.

### Env Files
- **D-07:** Update `.env.docker` — replace `MONGODB_URI=...` with `DATABASE_URL=postgresql://user:pass@postgres:5432/email_platform`. Add `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` for the postgres container.
- **D-08:** Update `.env.example` if it exists — same change as `.env.docker`.

### Network
- **D-09:** Postgres on `infra` network (same as mongodb was). Services on both `services` + `infra` (unchanged).

### Claude's Discretion
- Exact PostgreSQL port exposure (default 5432, no external mapping needed for dev)
- postgres:16 vs postgres:16-alpine (alpine preferred for size)
- Restart policy (keep `unless-stopped` consistent with other infra services)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Docker infrastructure
- `infra/docker-compose.yml` — Current docker-compose with MongoDB to replace
- `.env.docker` — Environment file for docker services
- `.env.example` — Template env file (if exists)

### Config (from Phase 9)
- `packages/config/src/infrastructure.ts` — DATABASE_URL schema (already updated)

</canonical_refs>

<code_context>
## Existing Code Insights

### Current MongoDB Service (to replace)
- Image: mongo:7, volume: mongo_data, healthcheck: mongosh ping
- 4 services depend on it: auth, sender, parser, audience

### Established Patterns
- All infra services follow same pattern: image, volume, restart, healthcheck, infra network
- All app services: build context, env_file, depends_on, restart, init, healthcheck, networks

### Integration Points
- `.env.docker` — DATABASE_URL must match postgres container credentials
- Service `depends_on` conditions use `service_healthy`

</code_context>

<specifics>
## Specific Ideas

- Each phase must verify all 6 services start and health checks pass
- Single database instance with per-service schemas (pgSchema) — one postgres container is sufficient

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 11-docker-infrastructure*
*Context gathered: 2026-04-04*
