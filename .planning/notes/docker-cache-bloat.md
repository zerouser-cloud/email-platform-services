# 2026-05-05 — Docker Cache + Image Bloat Investigation (seed for Phase 999.18.4 Plan 07)

> **Scope:** Seed for Plan 07 of Phase 999.18.4. PLAN.md will be created via
> `/gsd:plan-phase 999.18.4` after the current iteration of Plans 02-06 lands.

## Symptom

Local development host disk filled — root cause investigation showed Docker
consuming **100+ GB**. User has worked with Docker for many years and has not
seen this scale of cache accumulation before. This is anomalous, not normal.

## Initial Hypotheses (to be verified empirically in Plan 07)

1. **BuildKit cache mounts never GC'd.** `infra/docker/app.Dockerfile` declares
   `--mount=type=cache,id=pnpm-store,target=/pnpm/store` in both `prod-deps`
   and `builder` stages. BuildKit cache mounts are persistent across builds
   and **do not** participate in `docker system prune` by default — they live
   in `buildx` instance storage and require `docker buildx prune` to clean.
   With many rebuilds during the iterative refactor, the pnpm store cache may
   have ballooned with every dependency churn.
2. **Stale image layers from frequent rebuilds.** Each `pnpm start:isolated`
   with `--build` produces new image layers. Old layers become dangling but
   stay on disk until `docker image prune` runs. With 6 services × N rebuilds
   per refactor session, this accumulates.
3. **Stopped-container layer accumulation.** `pnpm reset:isolated` removes
   volumes but stopped containers may persist. Each container has a writable
   layer.
4. **Buildx builder instance(s) hoarding cache.** `docker buildx ls` typically
   shows one or more builders; their cache lives in dedicated docker volumes
   that survive `docker system prune`.
5. **Multi-arch QEMU emulation cache.** If multi-arch builds (`--platform linux/amd64,linux/arm64`)
   ran via QEMU, intermediate cross-build artifacts may have accumulated.

## What Plan 07 Should Investigate

- `docker system df -v` — full breakdown by category (images / containers / volumes / build cache)
- `docker buildx du` — per-builder cache size
- `docker images --filter dangling=true` — count dangling images
- `du -sh /var/lib/docker/{overlay2,volumes,buildkit}` — host-side filesystem view
- Identify **the dominant consumer** (build cache vs images vs volumes)

## What Plan 07 Should Deliver

1. **Diagnostic findings** — concrete sizes per category, dominant consumer identified.
2. **One-time cleanup** — recover the disk space (with explicit user approval, not silent destructive prune).
3. **Long-term hygiene** — choose ONE of:
   - **Periodic prune script** in `package.json` (e.g. `pnpm clean:docker` running `docker buildx prune --filter unused-for=168h` + `docker image prune --filter dangling=true`).
   - **Cache-mount size cap** via BuildKit `cache-from`/`cache-to` with `mode=max,compression=zstd` and explicit `max-size` (BuildKit ≥ 0.13 supports cache size limits).
   - **CI cache hygiene job** in `.gitlab-ci.yml` that prunes after each pipeline.
4. **Document the root cause** — so this doesn't surprise the team again. Update README or CONTRIBUTING with disk-space expectations and prune commands.

## Out of Scope (for Plan 07)

- Changes to the actual Dockerfile that affect cache hit rate (that is Plans 01-06 territory).
- CI builder configuration in GitLab (separate concern — cache hygiene there is a build-pipeline issue, not a local-dev one; can be a follow-up Plan 08 if needed).

## Constraints

- **No silent destructive operations.** `docker system prune --all --volumes` will wipe everything, including unrelated work. Plan 07 must propose explicit, scoped commands and ask for user approval before running them.
- **Preserve current isolated-mode workflow.** Whatever cleanup runs must not break `pnpm start:isolated` cold start (i.e. don't prune the base images that compose pulls).
- **Memory `feedback_use_package_scripts.md`:** any periodic cleanup must go through `pnpm` script, not raw `docker` invocations in CONTRIBUTING.

## References

- BuildKit cache mount docs: https://docs.docker.com/build/cache/backends/
- `docker buildx prune` man: https://docs.docker.com/reference/cli/docker/buildx/prune/
- BuildKit GC config: https://docs.docker.com/build/buildkit/configure/#garbage-collection
- Phase 999.18.3 Dockerfile two-install pattern (which introduced the pnpm-store cache mount): `.planning/phases/999.18.3-architectural-closure-5-layer-drop-husky-two-install/`
