# Can Coolify v4 Replace Diun for Image Monitoring?

**Researched:** 2026-04-06
**Confidence:** HIGH
**Short answer:** No. Coolify v4 has no built-in image monitoring. Diun (or equivalent) remains necessary.

---

## Question 1: Does Coolify have built-in "watch for new images"?

**Answer: No.** Confidence: HIGH.

Coolify v4 has no registry polling, image digest monitoring, or scheduled pull feature. The "Auto Deploy" feature only works for git-push events (via GitHub App webhooks), not for registry image updates.

Feature requests for this exist but are unimplemented:
- [Issue #2500](https://github.com/coollabsio/coolify/issues/2500) -- closed as "completed" but actually just converted to discussion #3162, which remains open with no implementation
- [Discussion #1753](https://github.com/coollabsio/coolify/discussions/1753) -- feature request for auto-update, no official response
- [Discussion #3162](https://github.com/coollabsio/coolify/discussions/3162) -- consolidated feature request, still open as of Feb 2025

Coolify added Diun as a one-click service template ([PR #5113](https://github.com/coollabsio/coolify/pull/5113)), which confirms they see it as a complementary tool, not a replacement.

## Question 2: Does "Auto Deploy" work for pre-built registry images?

**Answer: No.** Confidence: HIGH.

Coolify's Auto Deploy is exclusively git-triggered:
- GitHub App sends webhook on push to branch
- Coolify pulls repo, reads compose file, builds/pulls images, deploys

For pre-built images (our case: CI pushes to GHCR, Coolify pulls), the only trigger mechanisms are:
1. **Manual deploy** via Coolify UI
2. **API webhook** call: `GET /api/v1/deploy?uuid={uuid}` with Bearer token
3. **Git push** auto-deploy (irrelevant for pre-built images from CI)

Our current flow (CI -> GHCR -> Diun detects -> calls Coolify webhook) is the correct pattern.

## Question 3: Does Coolify use `--force-recreate`?

**Answer: It depends on resource type.** Confidence: HIGH.

Coolify has two distinct deployment paths:

| Resource Type | Source Code | Command | Force Recreate? |
|--------------|-------------|---------|-----------------|
| **Service** (compose pasted in UI) | `StartService.php` | `docker compose up -d --remove-orphans --force-recreate --build` | YES -- all containers |
| **Application** (compose from git repo) | `ApplicationDeploymentJob.php` | `docker compose up -d` | NO -- only changed |

**Critical distinction:** If your Docker Compose stack is created as a Coolify "Application" (connected to GitHub repo), it does NOT use `--force-recreate`. Only "Services" (compose pasted directly) use it.

Our setup uses Application type (connected to GitHub), so Coolify runs plain `docker compose up -d` which should only recreate containers whose images actually changed.

**Update to prior research:** The earlier `coolify-deploy-behavior.md` stated `--force-recreate` is always used. This is only true for the Service path (`StartService.php`), not the Application path (`ApplicationDeploymentJob.php`).

Sources:
- [ApplicationDeploymentJob.php](https://github.com/coollabsio/coolify/blob/v4.x/app/Jobs/ApplicationDeploymentJob.php) -- Application deploy: `up -d` without `--force-recreate`
- [StartService.php](https://github.com/coollabsio/coolify/blob/v4.x/app/Actions/Service/StartService.php) -- Service deploy: `up -d --force-recreate`

## Question 4: Does `docker compose up -d` (without `--force-recreate`) only recreate changed services?

**Answer: Yes, this is the documented default behavior.** Confidence: HIGH.

From [Docker official docs](https://docs.docker.com/reference/cli/docker/compose/up/):

> "If there are existing containers for a service, and the service's configuration or image was changed after the container's creation, docker compose up picks up the changes by stopping and recreating the containers (preserving mounted volumes)."

And regarding `--force-recreate`:

> "If you want to force Compose to stop and recreate **all** containers, use the --force-recreate flag."

So the default behavior (without `--force-recreate`) is selective: only services with changed images or config are recreated.

**Historical bug note:** Docker Compose v2.3.0 had a regression ([Issue #9259](https://github.com/docker/compose/issues/9259)) where image changes were not detected. This was fixed in the same release cycle via [PR #9261](https://github.com/docker/compose/pull/9261). Current Docker Compose versions (v2.20+) work correctly.

## Question 5: Is there a Coolify setting to change deploy behavior?

**Answer: Limited options.** Confidence: HIGH.

For Application-type Docker Compose deployments:
- **Force Rebuild** toggle -- adds `--no-cache` to build step, does NOT affect container recreation
- **Custom Start Command** -- lets you override the `docker compose up` command entirely
- **Raw Compose Deployment** -- deploys without Coolify's label injection

There is no toggle to add/remove `--force-recreate`. If you need it, use Custom Start Command.

## Docker Compose Native Behavior Summary

| Scenario | Command | Result |
|----------|---------|--------|
| Only gateway has new image | `docker compose up -d` | Only gateway recreated, others untouched |
| Only gateway has new image | `docker compose up -d --force-recreate` | ALL 6 services recreated |
| pull_policy: always + up -d | `docker compose up -d --pull always` | Pulls all images, recreates only those with new digests |
| Explicit pull then up | `docker compose pull && docker compose up -d` | Same: only changed services recreated |

**Key insight:** `pull_policy: always` in compose + `docker compose up -d` (no `--force-recreate`) achieves exactly what we want: pull all images, but only recreate services whose images actually changed.

## Implications for Current Architecture

### What we have now
- CI builds image -> pushes to GHCR
- Diun polls GHCR registries on schedule, detects new digest
- Diun calls Coolify webhook: `GET /api/v1/deploy?uuid={stack_uuid}`
- Coolify deploys the entire compose stack

### What actually happens (corrected understanding)
Since our stack is an Application (not Service), Coolify runs `docker compose up -d` WITHOUT `--force-recreate`. Combined with `pull_policy: always` in our compose file, this means:

1. Coolify runs `docker compose pull` (pulls all 6 images)
2. Coolify runs `docker compose up -d` (recreates ONLY services with new images)
3. Unchanged services remain running with zero downtime

**This is already the selective behavior we wanted.** The `--force-recreate` concern from prior research only applies to Service-type resources.

### Can we remove Diun?

**No.** Diun serves the role of detecting new images and triggering the deploy. Without Diun (or equivalent), nothing would call Coolify's deploy API when a new image appears in GHCR.

Alternatives to Diun for triggering deploys:
1. **GitHub Actions webhook** -- CI workflow calls Coolify API directly after pushing image (eliminates polling delay)
2. **GHCR webhook** -- GitHub Container Registry doesn't support webhooks natively
3. **Cron-based Coolify redeploy** -- Coolify has no built-in scheduled redeploy

**Recommended approach:** Replace Diun with a GitHub Actions step that calls Coolify's deploy API directly after image push. This is simpler, faster (no polling delay), and eliminates Diun as a dependency.

```yaml
# In .github/workflows/docker-build.yml, after image push:
- name: Trigger Coolify Deploy
  if: github.ref == 'refs/heads/main'
  run: |
    curl --silent --fail \
      --request GET "${{ secrets.COOLIFY_WEBHOOK_PROD }}" \
      --header "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
```

## Summary

| Question | Answer |
|----------|--------|
| Coolify built-in image watch? | No -- not implemented |
| Auto Deploy for registry images? | No -- git-push only |
| Coolify uses --force-recreate? | Services: yes. Applications: no |
| docker compose up -d selective? | Yes -- only recreates changed services |
| Setting to disable --force-recreate? | N/A for Applications (already doesn't use it) |
| Can we remove Diun entirely? | No, but can replace with GH Actions webhook call |

## Sources

### Primary (HIGH confidence)
- [Docker Compose up docs](https://docs.docker.com/reference/cli/docker/compose/up/) -- selective recreation behavior
- [ApplicationDeploymentJob.php](https://github.com/coollabsio/coolify/blob/v4.x/app/Jobs/ApplicationDeploymentJob.php) -- Application deploy command (no --force-recreate)
- [StartService.php](https://github.com/coollabsio/coolify/blob/v4.x/app/Actions/Service/StartService.php) -- Service deploy command (uses --force-recreate)
- [Coolify GitHub Actions docs](https://coolify.io/docs/applications/ci-cd/github/actions) -- webhook deploy pattern

### Secondary (MEDIUM confidence)
- [Issue #2500](https://github.com/coollabsio/coolify/issues/2500) -- image monitoring feature request (unimplemented)
- [Discussion #3162](https://github.com/coollabsio/coolify/discussions/3162) -- consolidated auto-update request
- [Docker Compose Issue #9259](https://github.com/docker/compose/issues/9259) -- image change detection regression (fixed)
- [Coolify Rolling Updates docs](https://coolify.io/docs/knowledge-base/rolling-updates) -- no rolling updates for Compose Services
