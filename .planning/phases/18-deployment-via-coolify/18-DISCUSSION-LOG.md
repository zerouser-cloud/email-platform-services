# Phase 18: Deployment via Coolify - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-05
**Phase:** 18-deployment-via-coolify
**Areas discussed:** Coolify project structure, Application deployment, MINIO → STORAGE rename, DNS & domains

---

## Coolify Project Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 1 project, 2 env (recommended) | One project "Email Platform" with dev and production environments | ✓ |
| 2 separate projects | Full isolation, overkill for one VPS | |

**User's choice:** 1 project, 2 environments

---

## Application Deployment

| Option | Description | Selected |
|--------|-------------|----------|
| Docker Compose (recommended) | One docker-compose.prod.yml with image: for all 6 services | ✓ |
| 6 separate Applications | Each service as individual Coolify resource | |

**User's choice:** Docker Compose resource

---

## MINIO → STORAGE Rename

| Option | Description | Selected |
|--------|-------------|----------|
| S3_ENDPOINT + S3_* | S3-specific naming | |
| STORAGE_ENDPOINT + STORAGE_* | Storage-agnostic naming, no protocol assumption | ✓ |

**User's choice:** STORAGE_* prefix
**Notes:** User preferred more abstract naming without binding to S3 protocol specifically.

---

## DNS & Domains

| Option | Description | Selected |
|--------|-------------|----------|
| api. + api.dev. (recommended) | API on subdomains, root free for frontend | ✓ |
| @ + dev. | Root occupied by API | |

**User's choice:** api.email-platform.pp.ua (prod), api.dev.email-platform.pp.ua (dev)
**Notes:** DNS already configured. Root and dev. reserved for future frontend.

---

## Claude's Discretion

- docker-compose.prod.yml structure details
- Coolify webhook configuration
- Resource limits
- Coolify admin subdomain

## Deferred Ideas

- Frontend deployment — separate project
- Monitoring/alerting — next milestone
- RabbitMQ → Redis Streams migration — future milestone
