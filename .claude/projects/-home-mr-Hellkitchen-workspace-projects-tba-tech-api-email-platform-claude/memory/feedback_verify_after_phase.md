---
name: Full verification after each phase
description: After each phase, run full verification flow - build, docker compose up, pnpm dev/start, curl health endpoints
type: feedback
---

After every phase completion, run full verification flow — not just build.

**Why:** User expects each phase to leave the project in a working state. Build-only check is insufficient — services must actually start and respond.

**How to apply:** After each phase execution completes:
1. `pnpm turbo build --force` — verify compilation
2. `docker compose -f infra/docker-compose.yml up -d` — start infrastructure
3. Wait for containers to be healthy
4. `curl http://localhost:4000/health/live` — gateway liveness
5. `curl http://localhost:4000/health/ready` — gateway readiness (checks all gRPC services)
6. Report results before declaring phase complete

Gateway is mapped to port 4000 (not 3000) in docker-compose. Health endpoints: `/health/live` and `/health/ready`.
