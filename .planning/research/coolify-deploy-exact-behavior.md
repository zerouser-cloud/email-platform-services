# Coolify Deploy API: Exact Behavior for Docker Compose Applications

**Researched:** 2026-04-06
**Coolify version:** v4.0.0-beta.442
**Confidence:** MEDIUM (source code read via GitHub raw + DeepWiki; some details inferred from code structure)

---

## 1. What Happens When `GET /api/v1/deploy?uuid=X&force=false` Is Called

### 1.1 Request Handling

The route is defined in `routes/api.php`:
```php
Route::match(['get', 'post'], '/deploy', [DeployController::class, 'deploy'])
    ->middleware(['api.ability:deploy']);
```

The `DeployController::deploy()` method resolves the UUID to an Application resource, then calls `queue_application_deployment()` which creates an `ApplicationDeploymentQueue` record with status `queued`. This is processed by `ApplicationDeploymentJob`.

**Source:** [DeepWiki - Deployment API](https://deepwiki.com/coollabsio/coolify/8.5-deployment-api), [GitHub source](https://github.com/coollabsio/coolify/blob/v4.x/app/Jobs/ApplicationDeploymentJob.php)

### 1.2 Deployment Sequence (Docker Compose Build Pack)

The `deploy_docker_compose_buildpack()` method executes this sequence:

1. **Clone the git repository** -- Yes, Coolify clones the repo fresh every deployment via `clone_repository()`. It uses a "coolify-helper" container to clone the code from the connected GitHub repository.

2. **Parse and inject into docker-compose.yaml** -- Coolify reads the compose file, injects Coolify-specific labels (`coolify.managed=true`), network configurations, and domain assignments per service.

3. **Build step** (conditional):
   - If services have `build:` context -- runs `docker compose build --pull [--no-cache]`
   - If services only use `image:` (pre-built, our case) -- **build step is skipped**

4. **Start step** -- runs the equivalent of:
   ```
   docker compose --env-file {workdir}/.env \
     --project-name {uuid} \
     --project-directory {workdir} \
     -f {workdir}/docker-compose.yaml \
     up -d
   ```

### 1.3 Critical Finding: NO --force-recreate in Application deployments

The `ApplicationDeploymentJob` uses plain `up -d` **without** `--force-recreate`.

This is different from Coolify "Services" (a separate resource type), which use `StartService` action with `--force-recreate --build --remove-orphans`.

**Confidence: HIGH** -- verified from source code on GitHub.

### 1.4 Summary of Commands for Pre-Built Images (Our Case)

```
git clone <repo>                          # fresh clone every time
# parse & inject compose file
docker compose ... up -d                  # NO --force-recreate, NO --build
```

The `pull_policy: always` in the compose file is what triggers image pulls. Coolify itself does NOT run a separate `docker compose pull` command.

---

## 2. Behavior of `docker compose up -d` with `pull_policy: always` (Without --force-recreate)

### 2.1 Pull Behavior

With `pull_policy: always`, Docker Compose pulls ALL images from the registry before starting. This is documented behavior:

> "Compose always pulls the image from the registry." -- [Docker Compose docs](https://docs.docker.com/reference/compose-file/services/#pull_policy)

Every service with `pull_policy: always` will have its image pulled on every `docker compose up -d`.

### 2.2 Recreation Decision

After pulling, Docker Compose compares the pulled image digest with the digest used by the running container. From the official docs:

> "If there are existing containers for a service, and the service's configuration or image was changed after the container's creation, docker compose up picks up the changes by stopping and recreating the containers (preserving mounted volumes)."
> -- [docker compose up docs](https://docs.docker.com/reference/cli/docker/compose/up/)

**Therefore:**
- If the pulled image has a **different digest** than the running container's image -- container is **recreated** (stopped, removed, new container created)
- If the pulled image has the **same digest** -- container is **left running untouched**
- Configuration changes in the compose file also trigger recreation

### 2.3 Historical Bugs (Now Fixed)

There were two relevant Docker Compose bugs that are **both fixed** in current versions:

| Bug | Affected Versions | Fixed In | Status |
|-----|-------------------|----------|--------|
| [#9259](https://github.com/docker/compose/issues/9259): `up` no longer recreates container if image updated | v2.3.0 only | v2.3.1+ (PR #9261) | FIXED |
| [#9617](https://github.com/docker/compose/issues/9617): `pull_policy: always` pulls but doesn't recreate on first run | v2.6.x - v2.16.x | v2.17.2+ | FIXED |

**Confidence: HIGH** -- both issues are closed with confirmed fixes. Any modern Docker Compose (v2.17.2+) correctly recreates containers when pulled images have new digests.

---

## 3. If Deploy API Is Called Once and 3/6 Images Have New Digests

**Expected behavior:**

1. Coolify clones the repo
2. `docker compose up -d` runs with `pull_policy: always` in compose file
3. Docker Compose pulls all 6 images
4. Compares digests: 3 images changed, 3 unchanged
5. **Exactly 3 containers are recreated** (stopped, removed, new ones started)
6. **The other 3 containers remain running** without restart

**Confidence: HIGH** -- this is the documented default behavior of `docker compose up -d`. The `--force-recreate` flag exists specifically to override this selective behavior, and Coolify does NOT use it for Application deployments.

**Important caveat:** If Coolify's compose file injection (labels, networks) changes between deploys, that counts as a "configuration change" and could trigger recreation of ALL containers even if images haven't changed. This would happen if Coolify updates its injected labels/config.

---

## 4. If Deploy API Is Called Twice in Quick Succession

### 4.1 Queue Architecture

Coolify uses Laravel's queue system (Laravel Horizon + Redis) for deployment processing.

**Behavior:**
- First call: creates `ApplicationDeploymentQueue` record with status `queued`, dispatches job
- Second call: creates ANOTHER `ApplicationDeploymentQueue` record with status `queued`, dispatches another job
- Both are queued -- **the second call is NOT rejected and does NOT cancel the first**

### 4.2 Processing Order

- Jobs are processed sequentially per server (not per application, per SERVER)
- The `concurrent_builds` server setting limits how many deployments run simultaneously
- If `concurrent_builds = 1` (common default), the second deployment waits until the first finishes

### 4.3 Queue Saturation

- Server-level `deployment_queue_limit` (default: 25) controls max queued deployments
- If limit reached, API returns `429 Too Many Requests` with `Retry-After: 60` header

### 4.4 Practical Scenario

If called twice quickly:
1. First deploy starts (status: `in_progress`) -- clones repo, runs `docker compose up -d`
2. Second deploy waits in queue (status: `queued`)
3. First deploy finishes (status: `finished`)
4. Second deploy starts -- clones repo again, runs `docker compose up -d` again
5. If no images changed between the two calls, second deploy is a no-op (all containers already have latest images)

**The second deploy is NOT wasted** -- it's just redundant if nothing changed between the two calls.

### 4.5 Cancellation

Either deployment can be cancelled via `POST /v1/deployments/{uuid}/cancel`:
- `queued` deployments: cancelled immediately
- `in_progress` deployments: Docker build container killed with `docker rm -f`, SSH process killed with `kill -9`

**Confidence: HIGH** -- queue architecture verified from DeepWiki and source code.

---

## 5. What `force=false` vs `force=true` Actually Controls

### 5.1 The Parameter

The `force` query parameter maps to `force_rebuild` in the `ApplicationDeploymentQueue` record.

### 5.2 What It Does

| `force` value | Build command | Start command |
|---------------|---------------|---------------|
| `false` (or omitted) | `docker compose build --pull` | `docker compose up -d` |
| `true` | `docker compose build --pull --no-cache` | `docker compose up -d` |

**It ONLY affects the build step.** It adds `--no-cache` to skip Docker layer caching during builds.

### 5.3 For Pre-Built Images (Our Case): IRRELEVANT

Since our compose file uses `image:` directives (pre-built GHCR images, no `build:` context), **the build step is skipped entirely**. The `force` parameter has NO effect on our deployment.

Both `force=true` and `force=false` result in the same command:
```
docker compose ... up -d
```

**Confidence: HIGH** -- verified from source code. The `force_rebuild` flag only adds `--no-cache` to the build command, which doesn't execute when there's nothing to build.

### 5.4 Bug Note

There was a bug ([#8104](https://github.com/coollabsio/coolify/issues/8104)) where `force=false` was parsed as truthy string, causing force rebuilds. Fixed in PRs #8178/#8180/#8202. Should be fixed in current version but worth noting.

---

## Summary Table

| Question | Answer | Confidence |
|----------|--------|------------|
| Does Coolify clone the repo? | Yes, fresh clone every deploy | HIGH |
| Does it run `docker compose pull`? | No. Relies on `pull_policy: always` in compose file | HIGH |
| Does it use `--force-recreate`? | No (Application type). Only Services use it | HIGH |
| Does it use `--build`? | Only if services have `build:` context | HIGH |
| With `pull_policy: always`, are all images pulled? | Yes, every time | HIGH |
| Are only changed containers recreated? | Yes, only those with new image digests or config changes | HIGH |
| What does `force` parameter do? | Adds `--no-cache` to build step. Irrelevant for pre-built images | HIGH |
| Concurrent deploys? | Queued sequentially per server, not rejected | HIGH |

---

## Implications for Our CI/CD Pipeline

1. **Single API call is sufficient** -- `docker compose up -d` with `pull_policy: always` will pull all images and recreate only changed ones.

2. **No need for `force=true`** -- it only affects Docker layer cache during builds, which we don't do.

3. **Selective recreation works** -- if CI pushes 3 new images, only those 3 containers restart. The other 3 keep running.

4. **No downtime for unchanged services** -- containers whose images didn't change are NOT restarted.

5. **Idempotent deploys** -- calling deploy twice with no image changes between calls results in a no-op on the second run.

6. **Compose file changes trigger full recreation** -- if Coolify's injected labels/config change, ALL containers may be recreated regardless of image changes.

---

## Sources

### Primary (HIGH confidence)
- [GitHub: ApplicationDeploymentJob.php](https://github.com/coollabsio/coolify/blob/v4.x/app/Jobs/ApplicationDeploymentJob.php) -- actual deployment commands
- [Docker Compose up docs](https://docs.docker.com/reference/cli/docker/compose/up/) -- recreation behavior
- [Docker Compose pull_policy docs](https://docs.docker.com/reference/compose-file/services/#pull_policy) -- pull behavior

### Secondary (HIGH confidence)
- [DeepWiki: Deployment API](https://deepwiki.com/coollabsio/coolify/8.5-deployment-api) -- queue architecture
- [DeepWiki: Build Strategies](https://deepwiki.com/coollabsio/coolify/5.2-build-strategies-and-build-packs) -- build pack differences
- [Coolify API docs](https://coolify.io/docs/api-reference/api/operations/deploy-by-tag-or-uuid) -- API parameters

### Verified Bug Reports
- [Docker Compose #9617](https://github.com/docker/compose/issues/9617) -- pull_policy recreation bug (FIXED in v2.17.2+)
- [Docker Compose #9259](https://github.com/docker/compose/issues/9259) -- image update recreation bug (FIXED in v2.3.1+)
- [Coolify #8104](https://github.com/coollabsio/coolify/issues/8104) -- force=false parsing bug (FIXED)
