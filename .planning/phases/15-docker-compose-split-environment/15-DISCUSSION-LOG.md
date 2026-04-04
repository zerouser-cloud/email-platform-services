# Phase 15: Docker Compose Split & Environment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.

**Date:** 2026-04-04
**Phase:** 15-docker-compose-split-environment
**Mode:** discuss
**Areas analyzed:** Compose split strategy, Env file strategy

## User Decisions

### Compose Split
- **Question:** include vs profiles vs separate -f?
- **User chose:** include (Recommended)
- **Rationale:** Two self-contained files, clean separation, each validates independently

### Environment Strategy
- **Question:** Remove NODE_ENV from env files?
- **User chose:** Yes, remove (Recommended)
- **Rationale:** 12-Factor — app doesn't know its environment. Config values drive behavior. Dockerfile keeps NODE_ENV=production for build optimization only.

## Identified Issues
- POSTGRES_PORT variable must be reverted (infrastructure-guard violation)
- Redis/RabbitMQ/MinIO missing host ports (local dev broken)
- CORS Zod refine depends on NODE_ENV — needs adjustment
- .env missing POSTGRES_USER/PASSWORD/DB keys
