# Phase 17: Docker Image Build & Push - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-04-04
**Phase:** 17-docker-image-build-push
**Areas discussed:** Build trigger, Tagging strategy, Matrix & caching, Org/repo naming, Workflow structure

---

## Build Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Only push to main | Images only for production. Simpler. | |
| push to main + dev | Images for both branches. Dev for staging. | ✓ |
| push to main + PR build-only | Images for main, build check on PR. | |

**User's choice:** push to main + dev
**Notes:** User confirmed: dev branch will also be deployed to a server for testing. Both branches need deployable images.

---

## Tagging Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| SHA + branch (recommended) | dev: dev-abc1234 + dev-latest. main: abc1234 + latest. | ✓ |
| Only SHA | Every image = abc1234. No latest. No branch distinction. | |
| SHA + semver for main | dev: dev-abc1234. main: v1.2.3 + abc1234 + latest. | |

**User's choice:** SHA + branch

---

## Matrix & Caching

| Option | Description | Selected |
|--------|-------------|----------|
| GHA cache (recommended) | Docker Buildx + cache-to/from type=gha with scope per service. | ✓ |
| Registry cache | Cache stored in GHCR as separate image. | |
| No cache | Every build from scratch. | |

**User's choice:** GHA cache with scope per service

---

## Org/Repo Naming

| Option | Description | Selected |
|--------|-------------|----------|
| email-platform-<service> (recommended) | ghcr.io/zerouser-cloud/email-platform-gateway, etc. | ✓ |
| Just <service> | ghcr.io/zerouser-cloud/gateway. Shorter but may conflict. | |

**User's choice:** email-platform-<service>
**Notes:** GHCR owner is zerouser-cloud (GitHub user account). Repository: email-platform-services.

---

## Workflow Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Separate workflow (recommended) | New docker-build.yml. CI and Docker build separated. | ✓ |
| Add to ci.yml | Everything in one file. Simpler but mixes concerns. | |

**User's choice:** Separate workflow

---

## Claude's Discretion

- Buildx setup details
- Platform specification
- Job naming

## Deferred Ideas

None.
