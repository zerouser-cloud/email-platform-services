---
phase: 17-docker-image-build-push
verified: 2026-04-04T17:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
---

# Phase 17: Docker Image Build & Push Verification Report

**Phase Goal:** Docker images for each service are automatically built and published to GHCR when changes merge to main
**Verified:** 2026-04-04T17:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Push to dev branch triggers 6 parallel Docker builds via matrix strategy | VERIFIED | `on.push.branches: [dev, main]` + `strategy.matrix.service: [gateway, auth, sender, parser, audience, notifier]` (6 services confirmed) |
| 2 | Push to main branch triggers 6 parallel Docker builds via matrix strategy | VERIFIED | Same trigger — both `dev` and `main` in branches list |
| 3 | Built images are pushed to GHCR with branch-aware tags (dev-`<sha7>`/dev-latest or `<sha7>`/latest) | VERIFIED | `metadata-action@v6` with 4 tag rules: `type=sha,prefix=dev-` + `type=raw,value=dev-latest` (dev), `type=sha,prefix=` + `type=raw,value=latest` (main); all gated via `enable=` flags |
| 4 | Each service has its own GHA cache scope — no cross-service cache eviction | VERIFIED | `cache-from: type=gha,scope=${{ matrix.service }}` and `cache-to: type=gha,mode=max,scope=${{ matrix.service }}` — both use matrix.service scope |
| 5 | New push to same branch cancels in-progress build | VERIFIED | `concurrency.group: docker-${{ github.ref }}` with `cancel-in-progress: true` |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/docker-build.yml` | Docker image build and push workflow with matrix strategy | VERIFIED | File exists at commit `71683e8`, 52 lines, valid YAML, contains matrix strategy for all 6 services |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `.github/workflows/docker-build.yml` | `infra/docker/app.Dockerfile` | `build-push-action` `file:` parameter | VERIFIED | `file: infra/docker/app.Dockerfile` confirmed in build-push step; Dockerfile exists at that path |
| `.github/workflows/docker-build.yml` | `ghcr.io` | `docker/login-action` `registry:` parameter | VERIFIED | `registry: ghcr.io` in login-action step with `password: ${{ secrets.GITHUB_TOKEN }}` and `packages: write` permission |

### Data-Flow Trace (Level 4)

Not applicable — this phase produces a GitHub Actions workflow file (CI/CD configuration), not a runtime component that renders dynamic data.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| YAML parses without errors | `python3 -c "import yaml; yaml.safe_load(open(...))"` | No parse errors | PASS |
| Matrix contains exactly 6 services | Python YAML inspection | `['gateway', 'auth', 'sender', 'parser', 'audience', 'notifier']` (count: 6) | PASS |
| `packages: write` permission present | Python YAML inspection | `permissions.packages = 'write'` | PASS |
| Both dev and main in push trigger | Python YAML inspection | `branches: ['dev', 'main']` | PASS |
| No `platforms:` directive present | `grep platforms: docker-build.yml` | No match — correct | PASS |
| No modifications to ci.yml | `git log --follow ci.yml` | Last commit is `6e608f0` (Phase 16) — not touched | PASS |
| Commit hash from SUMMARY exists | `git log --oneline` | `71683e8` confirmed in history | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DBLD-01 | 17-01-PLAN.md | Docker image build per service via matrix strategy in GitHub Actions | SATISFIED | Matrix strategy with 6 services confirmed in workflow; `strategy.matrix.service: [gateway, auth, sender, parser, audience, notifier]` |
| DBLD-02 | 17-01-PLAN.md | Images published to GHCR (GitHub Container Registry) | SATISFIED | `login-action` with `registry: ghcr.io` + `packages: write` + `push: true` in build-push-action |
| DBLD-03 | 17-01-PLAN.md | Scoped Docker layer cache per service | SATISFIED | `cache-from: type=gha,scope=${{ matrix.service }}` and `cache-to: type=gha,mode=max,scope=${{ matrix.service }}` — unique scope per matrix job |

All 3 requirements from the plan's frontmatter are accounted for. No orphaned requirements found — REQUIREMENTS.md maps exactly DBLD-01, DBLD-02, DBLD-03 to Phase 17 and no others.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | None found |

No TODO/FIXME/placeholder patterns. No empty implementations. No environment identity checks (NODE_ENV etc.). The workflow file is clean.

### Human Verification Required

#### 1. End-to-End Workflow Execution

**Test:** Push a commit to the `dev` branch with an inconsequential change and observe the Actions tab in GitHub.
**Expected:** Six parallel `Build <service>` jobs start; each builds the Docker image using `infra/docker/app.Dockerfile` with `APP_NAME=<service>` as build arg; each pushes `ghcr.io/<owner>/email-platform-<service>:dev-<sha7>` and `ghcr.io/<owner>/email-platform-<service>:dev-latest` to GHCR.
**Why human:** Cannot simulate GitHub Actions execution locally; requires a live push to trigger the workflow and observe real GHCR package creation.

#### 2. Cancellation Behavior

**Test:** Push two commits in rapid succession to the same branch.
**Expected:** The first workflow run is cancelled when the second starts (same concurrency group `docker-refs/heads/<branch>`).
**Why human:** Concurrency cancellation is a GitHub Actions runtime behavior that cannot be verified from workflow YAML alone.

#### 3. Cache Effectiveness

**Test:** Push two consecutive commits to dev; observe job logs for cache hit messages on the second run.
**Expected:** `docker/build-push-action` logs show cache hits from `type=gha,scope=<service>` on the second run, resulting in faster build times.
**Why human:** GHA cache behavior requires live execution; cache hits cannot be verified statically.

### Gaps Summary

No gaps found. All must-haves are satisfied:

- The single artifact (`.github/workflows/docker-build.yml`) exists, is substantive (52 lines, valid YAML, fully specified workflow), and is wired correctly to both the Dockerfile and GHCR registry.
- Both key links (workflow → Dockerfile and workflow → GHCR) are confirmed present with exact parameter values matching the plan specification.
- All 5 observable truths are verified against the actual file contents.
- All 3 requirement IDs (DBLD-01, DBLD-02, DBLD-03) are fully satisfied.
- No anti-patterns found.
- Existing files (`ci.yml`, `app.Dockerfile`) were not modified as required.

---

_Verified: 2026-04-04T17:00:00Z_
_Verifier: Claude (gsd-verifier)_
