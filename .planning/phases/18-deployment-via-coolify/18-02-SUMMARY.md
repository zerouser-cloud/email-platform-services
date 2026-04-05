---
phase: 18-deployment-via-coolify
plan: 02
subsystem: infra
tags: [coolify, postgresql, redis, rabbitmq, garage, s3, github-app]

requires:
  - phase: none
    provides: none
provides:
  - Coolify project with dev and production environments
  - PostgreSQL 17, Redis 7, RabbitMQ 3, Garage S3 in both environments
  - GitHub App connected for repo access
affects: [18-03-deploy-services]

tech-stack:
  added: [coolify-v4, postgresql-17, redis-7.2, rabbitmq-3, garage-v2.1.0]
  patterns: [coolify-resource-naming-convention]

key-files:
  created: []
  modified: []

key-decisions:
  - "PostgreSQL 17 instead of 16 — latest stable, no breaking changes"
  - "Garage for S3-compatible storage instead of MinIO on server"
  - "Dev RabbitMQ on host port 5673 to avoid conflict with production on 5672"
  - "GitHub App redirect URL workaround — manual IP replacement for LAN-only Coolify"

patterns-established:
  - "Coolify resource naming: email-platform-{service}-{env} (e.g., email-platform-postgres-prod)"
  - "Infrastructure per environment: separate DB/cache/queue instances for dev and production"

requirements-completed: [DPLY-01]

duration: 25min
completed: 2026-04-05
---

# Plan 18-02: Coolify Project Setup Summary

**Coolify project with 8 infrastructure resources (PostgreSQL, Redis, RabbitMQ, Garage) across dev and production environments, plus GitHub App integration**

## Performance

- **Duration:** ~25 min (interactive human-action tasks)
- **Started:** 2026-04-05
- **Completed:** 2026-04-05
- **Tasks:** 2 (both checkpoint:human-action)
- **Files modified:** 0 (all changes in Coolify UI)

## Accomplishments
- GitHub App connected to Coolify with access to zerouser-cloud/email-platform-services
- Coolify project "email_platform" created with dev and production environments
- 4 infrastructure resources per environment (8 total), all running:
  - PostgreSQL 17-alpine
  - Redis 7.2
  - RabbitMQ 3-management
  - Garage v2.1.0 (S3-compatible)

## Infrastructure Resources

Credentials stored in Coolify UI only (not committed to git).

### PRODUCTION
- PostgreSQL 17 — `email-platform-postgres-prod` (hostname: `akgk08g4gkwoscw0sc44kks8`)
- Redis 7.2 — `email-platform-redis-prod` (hostname: `x0c0kc40gw4os4ss44kss00s`)
- RabbitMQ 3 — `email-platform-rabbitmq-prod` (host port: 5672)
- Garage v2.1.0 — `email-platform-s3-prod` (bucket/keys to be configured in plan 03)

### DEV
- PostgreSQL 17 — `email-platform-postgres-dev` (hostname: `g00cw80skc08k0s8484cgwwc`)
- Redis 7.2 — `email-platform-redis-dev` (hostname: `uc084o00g8okkw00koc844k8`)
- RabbitMQ 3 — `email-platform-rabbitmq-dev` (host port: 5673)
- Garage v2.1.0 — `email-platform-s3-dev` (bucket/keys to be configured in plan 03)

## Decisions Made
- PostgreSQL 17 instead of planned 16 — Coolify default, fully compatible
- GitHub App redirect required manual URL fix (77.120.128.84 → 192.168.1.25) due to LAN-only Coolify
- Dev RabbitMQ host port changed to 5673 to avoid port conflict with production instance

## Deviations from Plan
None significant — plan executed as specified with minor version and port adjustments.

## Issues Encountered
- GitHub App OAuth redirect went to external IP (77.120.128.84:8000) instead of LAN (192.168.1.25:8000) — fixed by manually editing redirect URL in browser
- Dev RabbitMQ port 5672 conflict with production — changed host binding to 5673

## Next Phase Readiness
- All infrastructure running and ready for application deployment (Plan 18-03)
- Garage bucket and access keys still need to be created during Plan 18-03
- DNS configured in Cloudflare, Traefik routes added for email-platform.pp.ua subdomains

---
*Phase: 18-deployment-via-coolify*
*Completed: 2026-04-05*
