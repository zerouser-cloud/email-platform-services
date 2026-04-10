# Milestones

## v3.0 Infrastructure & CI/CD (Shipped: 2026-04-08)

**Phases completed:** 9 phases, 13 plans, 23 tasks

**Key accomplishments:**

- Split docker-compose into infra-only and full-stack files with include directive, synced env files, and CORS_STRICT flag replacing NODE_ENV
- GitHub Actions CI with 3 parallel Turbo --affected jobs, husky pre-push hook, and branch protection script for dev/main
- Isolated infra services from host network in full Docker mode, dev-ports override for local development
- GitHub Actions matrix workflow builds 6 service images in parallel and pushes to GHCR with branch-aware tags and per-service scoped cache
- Removed duplicate PersistenceModule.forRootAsync() from 4 HealthModules to eliminate double PG connection pools and DI resolution failures in Docker
- Created no-magic-values skill with decision tree classifying all magic value types, four extraction patterns, and code review checklist
- Named constants for all foundation literals -- pool config, health checks, fallback strings, log statuses -- plus NODE_ENV and process.env removal for 12-Factor/env-schema compliance
- Symbol-based DI tokens for all 5 services, COLUMN_LENGTH constants in all 4 schemas, BOOTSTRAP constant in all 6 main.ts files
- Coolify project with 8 infrastructure resources (PostgreSQL, Redis, RabbitMQ, Garage) across dev and production environments, plus GitHub App integration
- Dev and production environments deployed on Coolify with Diun-based auto-deploy, Cloudflare HTTPS, and branch protection
- Diun labels on all 6 services with single webhook trigger via gateway watch_repo, plus health liveness cleanup

---
