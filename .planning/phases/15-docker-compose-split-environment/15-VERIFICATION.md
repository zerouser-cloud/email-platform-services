---
phase: 15-docker-compose-split-environment
verified: 2026-04-04T14:30:00Z
status: passed
score: 8/8 must-haves verified
gaps: []
human_verification:
  - test: "Start infra-only mode and verify all 4 services healthy"
    expected: "docker compose -f infra/docker-compose.infra.yml up -d starts postgres, redis, rabbitmq, minio with healthy status"
    why_human: "Requires Docker daemon running and containers actually starting"
  - test: "Start full Docker mode and verify all 10 containers healthy"
    expected: "docker compose -f infra/docker-compose.yml up --build starts all 10 containers"
    why_human: "Requires Docker daemon, full build, and inter-service gRPC communication"
  - test: "Verify host ports are reachable in infra-only mode"
    expected: "pg_isready -h localhost -p 5432 succeeds, redis-cli ping on 6379, RabbitMQ UI on 15672, MinIO console on 9001"
    why_human: "Requires running containers and network connectivity"
---

# Phase 15: Docker Compose Split & Environment Verification Report

**Phase Goal:** Developers have two working development modes -- local dev (infra in Docker, services on host) and full Docker -- with correct environment configuration and no unauthorized port overrides
**Verified:** 2026-04-04T14:30:00Z
**Status:** passed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | docker compose -f infra/docker-compose.infra.yml config validates without errors | VERIFIED | `docker compose config --quiet` exits 0 |
| 2 | docker compose -f infra/docker-compose.yml config validates without errors | VERIFIED | `docker compose config --quiet` exits 0 |
| 3 | Infra-only mode exposes PostgreSQL 5432, Redis 6379, RabbitMQ 5672+15672, MinIO 9000+9001 on host | VERIFIED | All 6 port mappings present as hardcoded `host:container` pairs in docker-compose.infra.yml |
| 4 | POSTGRES_PORT variable does not exist anywhere in compose files | VERIFIED | `grep POSTGRES_PORT` returns no matches (exit 1) |
| 5 | .env, .env.docker, .env.example have identical key sets | VERIFIED | `diff` of sorted keys shows exact match (.env has 29 keys, .env.docker/.env.example have 30 -- PROTO_DIR is the documented Docker-only exception) |
| 6 | NODE_ENV does not appear in any env file | VERIFIED | `grep NODE_ENV` across all 3 env files and env-schema.ts returns no matches |
| 7 | PROTO_DIR does not appear in .env (only in .env.docker and .env.example) | VERIFIED | .env has 29 keys (no PROTO_DIR), .env.docker and .env.example have 30 keys (PROTO_DIR present) |
| 8 | All 6 services defined in full docker-compose.yml with correct depends_on | VERIFIED | gateway, auth, sender, parser, audience, notifier all present with appropriate depends_on chains |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `infra/docker-compose.infra.yml` | Self-contained infra-only compose | VERIFIED | 72 lines, 4 services (postgres, redis, rabbitmq, minio), 3 volumes, infra network, all healthchecks present |
| `infra/docker-compose.yml` | Full-stack compose with include directive | VERIFIED | 153 lines, include directive on line 1-2, 6 app services, services network, env_file references to ../.env.docker |
| `packages/config/src/env-schema.ts` | Zod schema without NODE_ENV, with CORS_STRICT | VERIFIED | 51 lines, no NODE_ENV field, CORS_STRICT as z.coerce.boolean().default(false), refine uses CORS_STRICT instead of NODE_ENV |
| `.env` | Local dev env with all keys except PROTO_DIR | VERIFIED | 29 keys, localhost hostnames, LOG_FORMAT=pretty, no PROTO_DIR |
| `.env.docker` | Docker env with all keys including PROTO_DIR | VERIFIED | 30 keys, Docker service hostnames, LOG_FORMAT=json, PROTO_DIR=/app/proto |
| `.env.example` | Tracked template with all keys including PROTO_DIR | VERIFIED | 30 keys, documented with comments explaining local vs Docker values |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `infra/docker-compose.yml` | `infra/docker-compose.infra.yml` | include directive | WIRED | Line 2: `- docker-compose.infra.yml` |
| `infra/docker-compose.infra.yml` | `.env` | env_file for infra services | WIRED | Infra services use `${VAR:-default}` pattern; .env provides values when started standalone |
| `infra/docker-compose.yml` | `.env.docker` | env_file for app services | WIRED | All 6 services have `env_file: ../.env.docker` |
| `packages/config/src/env-schema.ts` | CORS_STRICT flag | Zod refine | WIRED | Line 31: `!(data.CORS_STRICT && data.CORS_ORIGINS === '*')` |

### Data-Flow Trace (Level 4)

Not applicable -- this phase modifies infrastructure configuration files, not components rendering dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Both compose files validate | `docker compose config --quiet` on both | Exit 0 for both | PASS |
| Build succeeds with updated schema | `pnpm build` | 10/10 Turbo tasks successful (3.5s) | PASS |
| POSTGRES_PORT eliminated | `grep POSTGRES_PORT infra/` | No matches | PASS |
| NODE_ENV eliminated from config | `grep NODE_ENV` across env files + schema | No matches | PASS |
| Key sets synchronized | `diff` of sorted keys | Exact match (PROTO_DIR exception confirmed) | PASS |
| .env.docker in .gitignore | `grep .env.docker .gitignore` | Found on line 17 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DOCK-01 | 15-01-PLAN | Docker Compose split into infra and services via include | SATISFIED | docker-compose.infra.yml (self-contained) + docker-compose.yml (include directive) |
| DOCK-02 | 15-01-PLAN | Infrastructure ports exposed for local dev (5432, 6379, 5672, 9000) | SATISFIED | All standard ports hardcoded in docker-compose.infra.yml: 5432, 6379, 5672+15672, 9000+9001 |
| DOCK-03 | 15-01-PLAN | POSTGRES_PORT variable reverted -- standard 5432 | SATISFIED | grep returns zero matches across both compose files |
| DOCK-04 | 15-01-PLAN | Env files synchronized -- same set of keys | SATISFIED | diff confirms matching key sets; PROTO_DIR Docker-only exception documented |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | No anti-patterns detected |

No TODO/FIXME/PLACEHOLDER comments found. No NODE_ENV references. No POSTGRES_PORT variables. No hardcoded empty returns. CORS_STRICT boolean flag properly replaces environment-identity-based check (12-Factor compliant).

### Human Verification Required

### 1. Infra-Only Mode Startup

**Test:** Run `docker compose -f infra/docker-compose.infra.yml up -d` and verify all 4 services reach healthy state with `docker compose -f infra/docker-compose.infra.yml ps`
**Expected:** postgres, redis, rabbitmq, minio all show "healthy" status
**Why human:** Requires Docker daemon running and actual container health checks passing

### 2. Host Port Accessibility

**Test:** With infra-only mode running, verify ports from host:
- `pg_isready -h localhost -p 5432`
- `docker compose exec redis redis-cli ping`
- Open http://localhost:15672 (RabbitMQ management, guest/guest)
- Open http://localhost:9001 (MinIO console)
**Expected:** All 4 infrastructure services accessible from host
**Why human:** Requires running containers and network/browser verification

### 3. Full Docker Mode Startup

**Test:** Run `docker compose -f infra/docker-compose.yml up --build` and verify all 10 containers start
**Expected:** 4 infra + 6 app services all running and healthy
**Why human:** Requires full Docker build and inter-service gRPC communication

### Gaps Summary

No gaps found. All 8 must-have truths verified through automated checks. All 4 requirements (DOCK-01 through DOCK-04) satisfied with concrete evidence. Build passes with the updated Zod schema. The only items requiring human verification are runtime behaviors (container startup and port accessibility) that cannot be tested without Docker daemon.

---

_Verified: 2026-04-04T14:30:00Z_
_Verifier: Claude (gsd-verifier)_
