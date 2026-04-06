---
phase: 18-deployment-via-coolify
plan: 03
subsystem: infra
tags: [coolify, docker-compose, cloudflare, traefik, diun, github-actions, branch-protection]

requires:
  - phase: 18-01
    provides: docker-compose.prod.yml, GHA workflow, STORAGE_* env vars
  - phase: 18-02
    provides: Coolify project, infrastructure resources, GitHub App
provides:
  - Dev and production environments deployed and accessible via HTTPS
  - Auto-deploy pipeline via Diun (image watcher)
  - Branch protection on dev and main
  - Coolify admin accessible at hostkitchen.pp.ua
affects: [future-phases-all]

tech-stack:
  added: [diun, cloudflare-proxy, traefik-v3]
  patterns: [pull-based-deploy, branch-protection-flow]

key-files:
  created: []
  modified:
    - docker-compose.prod.yml (expose instead of ports, pull_policy always)
    - .github/workflows/docker-build.yml (removed deploy job)
    - .github/workflows/ci.yml (fetch base branch, origin/ prefix for turbo)
    - infra/docker/app.Dockerfile (added proto generate step)
    - apps/*/src/*.constants.ts (DI tokens extracted from modules)

key-decisions:
  - "Cloudflare Flexible SSL + http:// domains in Coolify — no Let's Encrypt"
  - "Diun for auto-deploy instead of GHA webhook or Coolify auto-deploy"
  - "expose instead of ports for gateway — multi-env on same host"
  - "pull_policy: always — Coolify image caching workaround"
  - "Branch protection with required status checks — no direct push"
  - "hostkitchen.pp.ua domain for Coolify admin panel"

patterns-established:
  - "Pull-based deploy: Diun monitors GHCR → calls Coolify API on new digest"
  - "Git flow: feature branch → PR → dev → PR → main"

requirements-completed: [DPLY-01, DPLY-02, DPLY-03, DPLY-04]

duration: ~8h
completed: 2026-04-06
---

# Plan 18-03: Service Deployment and Auto-Deploy Pipeline

**Dev and production environments deployed on Coolify with Diun-based auto-deploy, Cloudflare HTTPS, and branch protection**

## Performance

- **Duration:** ~8h (interactive, multiple debugging sessions)
- **Started:** 2026-04-05
- **Completed:** 2026-04-06
- **Tasks:** 2 (both checkpoint:human-action)
- **Files modified:** 8

## Accomplishments
- Dev environment deployed: api.dev.email-platform.pp.ua/health/live returns v2
- Production environment deployed: api.email-platform.pp.ua/health/live returns ok
- Diun image watcher configured — monitors GHCR, triggers Coolify redeploy
- Cloudflare → External Traefik → Coolify Traefik chain working
- Branch protection on dev and main (require PR + status checks)
- Coolify admin accessible at hostkitchen.pp.ua
- GitHub webhook for push-based deploy (working but being replaced by Diun)

## Decisions Made
- Cloudflare Flexible SSL — origin receives HTTP, Cloudflare handles HTTPS
- Traefik v3 HostRegexp syntax (breaking change from v2)
- Diun for pull-based auto-deploy — GitHub doesn't know about hosting
- hostkitchen.pp.ua as separate domain for Coolify admin
- Coolify API token for Diun webhook calls
- Gateway uses expose not ports (multi-env port conflict)

## Issues Encountered
- Coolify cached stale Docker images → fixed with pull_policy: always
- Circular imports in all services → extracted DI tokens to *.constants.ts
- Cloudflare + Coolify TLS redirect loop → Flexible mode + http:// domains
- Traefik v3 HostRegexp syntax change → updated config
- Coolify admin redirect to https:80 → removed sslheader middleware
- Let's Encrypt rate limiting → not needed with Cloudflare
- Diun sends 6 webhooks per update cycle → needs deduplication

## Known Issues (for next phase)
- Diun triggers 6 concurrent deploys (one per image) → needs fixing
- Prod UUID not in Diun webhook → only dev auto-deploys
- GitHub Manual Webhook still active → should be removed (Diun replaces it)
- Diun monitors ALL containers (27) → should filter to only our images
- Coolify WebSocket warning on external access

## Next Phase Readiness
- Core deployment pipeline works end-to-end
- Needs polish: Diun deduplication, prod webhook, cleanup GitHub webhooks

---
*Phase: 18-deployment-via-coolify*
*Completed: 2026-04-06*
