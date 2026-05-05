# 2026-05-05 — gRPC Health Probe Delivery Hardening

> **Purpose:** Capture the architectural decision and rationale for replacing the
> `apk add wget + github-release` delivery of `grpc_health_probe` in
> `infra/docker/app.Dockerfile` with a `COPY --from=ghcr.io/...` pattern.
> Seed for Phase 999.18.4 Plan 01.

---

## Context

Discovered during `/gsd:explore` session 2026-05-05 while reviewing
`infra/docker/app.Dockerfile` (post-Phase 999.18.3 closure, commit `0d9cf03`).

**Current implementation (builder stage, lines 62-67):**

```dockerfile
ARG GRPC_HEALTH_PROBE_VERSION
RUN apk add --no-cache wget \
    && wget -qO/usr/local/bin/grpc_health_probe \
        "https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-$(apk --print-arch | sed 's/x86_64/amd64/;s/aarch64/arm64/')" \
    && chmod +x /usr/local/bin/grpc_health_probe
```

## Pain Points

1. **Brittle architecture mapping.** `apk --print-arch | sed 's/x86_64/amd64/;s/aarch64/arm64/'`
   — silently breaks on `armv7`, `ppc64le`, `s390x`, or any apk output format change.
   No coverage for project's stated multi-arch CI strategy
   (memory `project_multiarch_runner_agnostic.md`).
2. **Extra layer + dependency.** `apk add --no-cache wget` adds an apk install layer
   - transient dependency on alpine package mirror availability during build.
3. **Network dependency on github.com release CDN during build.** CI without internet
   or transient GitHub release outage breaks the build. No checksum verification.
4. **Bloats builder stage.** The probe binary lives in builder, then `COPY --from=builder`
   into runner — runs through an extra stage.

## Server↔Probe Contract (verified)

The connection is **not implicit/handshake**, it follows the published gRPC standard
`grpc.health.v1.Health` (https://github.com/grpc/grpc/blob/master/doc/health-checking.md):

- **Server side (our code):** `packages/foundation/src/external/grpc/grpc-server.factory.ts:28-40`
  uses `HealthImplementation` from npm `grpc-health-check` (official grpc-ecosystem).
  Registered via `onLoadPackageDefinition` callback — applies to all 5 gRPC services
  (auth, sender, parser, audience, notifier).
- **Probe side (external binary):** `grpc_health_probe` (Go binary by grpc-ecosystem)
  invoked as docker-compose `healthcheck.test` and as k8s `livenessProbe.exec.command`
  - `readinessProbe.exec.command`.
- Both ends are **official grpc-ecosystem implementations** of the standard.

Files invoking the binary:

- `infra/docker-compose.yml:49,74,99,122,145` — auth/sender/parser/audience/notifier
- `deploy/k8s/base/{auth,sender,parser,audience}.yaml` — liveness + readiness probes

## Decision

Replace the `apk + wget` block with `COPY --from=ghcr.io/grpc-ecosystem/grpc-health-probe`
referenced **directly into Stage 2 runner**, bypassing builder entirely.

### Verified facts

- Official image: `ghcr.io/grpc-ecosystem/grpc-health-probe`
- Multi-arch manifest covers: `linux/amd64`, `linux/arm/v7`, `linux/arm64/v8`, `linux/ppc64le`, `linux/s390x`
  (BuildKit auto-resolves via `$TARGETPLATFORM`)
- Binary path inside image: **`/bin/grpc_health_probe`** (verified against upstream Dockerfile —
  `COPY --from=build /go/bin/grpc-health-probe /bin/grpc_health_probe`).
  NOT `/ko-app/...` (image is built via regular Dockerfile, not via `ko`).
- Latest version: `v0.4.48` (project currently pins `v0.4.24`)

### Three concerns (split into three atomic Plans inside Phase 999.18.4)

| #   | Plan slug                           | Concern                                                                                                                                                   |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `01-grpc-health-probe-copy-from`    | Drop `apk + wget`; introduce `COPY --from=ghcr.io/grpc-ecosystem/grpc-health-probe:v0.4.24`. Tag pin retained as-is for minimal change-set.               |
| 2   | `02-grpc-health-probe-version-bump` | Bump `v0.4.24 → v0.4.48`. Single ARG default change.                                                                                                      |
| 3   | `03-grpc-health-probe-digest-pin`   | Replace tag pin (mutable) with digest pin (`@sha256:…`) — supply-chain hardening. Aligns with DevSecOps trajectory (memory `project_devsecops_state.md`). |

### Why three Plans (not one)

User-requested **interactive iterative phase mode**: one concern = one atomic commit
= one revertable step. If digest pin breaks multi-arch resolution under buildx,
revert is `/gsd:undo` of one commit — not the whole bundle.

## Out of Scope

- `infra/docker-compose.yml` — `test:` lines reference `grpc_health_probe` by name on PATH,
  unchanged (binary lands at `/usr/local/bin/grpc_health_probe` — same as today).
- `deploy/k8s/base/*.yaml` — same path contract preserved, no change.

## Verification (per Plan)

- `pnpm start:isolated` (and `pnpm start:native`) post-build — full smoke per
  `runtime-smoke-verification` skill.
- `docker compose -f infra/docker-compose.yml exec auth grpc_health_probe -addr=:50051` —
  direct invocation inside one gRPC service container, expect exit 0.
- `curl http://localhost:3000/health/ready` on gateway — aggregate health check passes.
- Image size delta inspection (`docker image inspect`) — should not regress materially.
- Multi-arch build validation (`docker buildx build --platform linux/amd64,linux/arm64`) —
  Plan 01 should resolve probe binary correctly per platform.

## References

- Upstream Dockerfile: https://github.com/grpc-ecosystem/grpc-health-probe/blob/master/Dockerfile
- Container registry: https://github.com/grpc-ecosystem/grpc-health-probe/pkgs/container/grpc-health-probe
- gRPC Health Checking Protocol: https://github.com/grpc/grpc/blob/master/doc/health-checking.md
- Phase 999.18.1 ADR §Decision (c.2): registered `grpc.health.v1.Health` per
  `grpc_health_probe`-in-distroless decision (alpine→distroless transport-aligned healthcheck)
- Phase 999.18.3 invariant `I-S2.1.6`: pinned `grpc_health_probe` version per security advisory —
  preserved (tag stays in Plan 01; tightened to digest in Plan 03)
