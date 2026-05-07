# DevOps Handoff — Email Platform Security Tooling

> **Phase 999.17 artifact.** See `.planning/phases/999.17-devsecops-shift-left-security-tooling/`.
> **Owner:** DevOps. **Activation:** post-phase.
> **Scope:** this document covers what DevOps needs to operationalize the security
> tooling shipped by Phase 999.17 (developer-side hooks) into a full CI security
> pipeline (server-side enforcement + continuous scanning).

Phase 999.17 ships only the **developer side** (D-05): pre-commit + pre-push hooks
running scanners locally on staged files / diffs. The CI security pipeline,
server-side push protection, license dashboards, runtime security, and continuous
image rescan are explicitly **out of scope for this phase** — they are DevOps's
domain. This document is the bridge: every dev-side artifact has a CI-tier
counterpart documented here, with image tags, flags, and Quality Gate thresholds
matching exactly what the developer hooks already enforce locally.

**Companion artifact:** [`.gitlab-ci-security.yml.example`](.gitlab-ci-security.yml.example)
at repo root — copy-paste-ready GitLab CI YAML reference template. This document
explains the *why*; the YAML example provides the *how*.

---

## Tools Inventory

Every scanner pinned per **D-14** (min versions) and **D-16** (Docker-wrapped
invocation pattern). Image tags below are the **exact tags shipped in
`package.json` `security:*` scripts and `scripts/security/*.sh`** by Plans 06–08
of this phase — drift between dev-side and CI tier causes false-positive churn,
so CI tier MUST match.

| Tool | Mode | Min Version (D-14) | Docker Image (D-16) | Native Install | Owner | When |
| ---- | ---- | ------------------ | ------------------- | -------------- | ----- | ---- |
| gitleaks | secret scan | gitleaks ≥ 8.30 | `zricethezav/gitleaks:v8.30.1` | `brew install gitleaks` / `apt install gitleaks` / `scoop install gitleaks` | Dev (pre-commit, staged-only) + DevOps (CI, full history) | every commit (dev) / every MR + main (CI) |
| Semgrep | SAST | Semgrep ≥ 1.50 | `returntocorp/semgrep:1.50` | `pip install semgrep` / `brew install semgrep` | Dev (pre-push, diff vs `origin/main`) + DevOps (CI, full repo scan) | every push (dev) / every MR + main (CI) |
| Trivy `config` | IaC misconfig | Trivy ≥ 0.50 | `aquasec/trivy:0.50.4` | `brew install trivy` / `apt install trivy` / `scoop install trivy` | Dev (pre-push, conditional on Dockerfile/compose change) + DevOps (CI) | infra changes (dev) / every MR + main (CI) |
| Trivy `fs` | npm SCA + license | Trivy ≥ 0.50 | `aquasec/trivy:0.50.4` | — (CI only) | **CI ONLY** (D-06) — needs ~1 GB CVE feed | DevOps | every MR + main |
| Trivy `image` | built-artifact CVE | Trivy ≥ 0.50 | `aquasec/trivy:0.50.4` | — (CI only) | **CI ONLY** (D-06) — needs CVE feed + built image | DevOps | after image build + nightly cron (deferred) |
| Syft | SBOM generation | Syft ≥ 1.40 | `anchore/syft:v1.40` | `brew install syft` / `apt install syft` | **CI ONLY** | DevOps | after image build (every main commit) |
| Renovate | auto-dep-update bot | runner version is DevOps choice | Mend GitHub App OR self-hosted runner image | — | **CI ONLY** (config in repo, runner external) | DevOps installs | continuous (config-driven schedule) |

**Pin policy (Plan 06–07 deviations):** Docker Hub publishes full SemVer tags
(`v8.30.1`, `0.50.4`) for some images and minor aliases (`1.50`) for others.
The dev-side hooks pin the exact tag that resolves on Docker Hub today; CI MUST
match those tags byte-for-byte. Tag bumps for security tooling = 1-character
edit + code review, identical cadence on dev-side and CI tier. **Never use
floating tags like the unpinned default — every image must carry an explicit
SemVer.**

**Verification command for cross-tier consistency:**

```bash
# All four scanner image tags should appear identically in package.json scripts,
# scripts/security/*.sh, and .gitlab-ci-security.yml.example:
grep -hoE '(zricethezav/gitleaks|returntocorp/semgrep|aquasec/trivy|anchore/syft):[a-zA-Z0-9.]+' \
  package.json scripts/security/*.sh .gitlab-ci-security.yml.example | sort -u
```

Expected output (no other variants):

```
anchore/syft:v1.40
aquasec/trivy:0.50.4
returntocorp/semgrep:1.50
zricethezav/gitleaks:v8.30.1
```

---

## CI Integration

### Recommended stages

Two-stage pipeline minimizes feedback loop on common failures:

1. **`security-fast`** — secrets + SAST. Parallel-eligible, fail-fast (no Docker
   image build needed). Catches the highest-severity / highest-frequency
   findings (leaked credentials, OWASP Top 10) before any expensive work.
2. **`security-deep`** — container-config + container-CVE + license + SBOM.
   Runs after build. Slower (CVE feed download, image scan). Findings here
   typically require coordinated remediation, not single-line fixes.

This mirrors the dev-side ordering: pre-commit catches secrets cheaply; pre-push
catches SAST/IaC findings before they reach the server; CI catches the SCA +
license + image-CVE classes that need the CVE feed (which is too large for
local install — D-06).

### Docker-wrapped invocation (recommended for portability)

Per D-16, the dev-side hooks use Docker-wrapped scanners so contributors don't
need to install binaries. The same pattern works on any CI runner with Docker:

```bash
docker run --rm \
  -v "$(pwd):/repo" -w /repo \
  zricethezav/gitleaks:v8.30.1 \
  git --no-banner --redact
```

The `-v "$(pwd):/repo" -w /repo` mount is read-only-effective (scanners only
read; they do not write inside `/repo`). **Never expose the Docker socket
(`-v /var/run/docker.sock:...`) — that is a container escape primitive.**

### Native-binary install (faster on dedicated CI runners)

If your CI runners are dedicated (not ephemeral) and you control the base
image, native install is faster (no Docker pull + start overhead per job):

```bash
# Debian/Ubuntu CI image:
apt-get update && apt-get install -y gitleaks trivy
pip install --no-cache-dir semgrep==1.50
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin v1.40

# Alpine CI image:
apk add --no-cache gitleaks trivy
pip install --no-cache-dir semgrep==1.50
# Syft: same install.sh URL works on Alpine
```

Tradeoff: native install is faster on hot runners, but less portable — every
runner image needs maintenance. Docker-wrapped is the project default; native
is an optimization DevOps can apply post-baseline.

### Reference template

Copy/adapt [`.gitlab-ci-security.yml.example`](.gitlab-ci-security.yml.example)
at repo root. It encodes all of the above (image tags, flags, stages, rules)
and is kept in lockstep with this document by phase acceptance criteria.

### Plain CLI vs GitLab built-in templates

GitLab ships built-in CI templates: `Security/SAST.gitlab-ci.yml`,
`Security/Secret-Detection.gitlab-ci.yml`, `Security/Container-Scanning.gitlab-ci.yml`.
**On GitLab Free tier these built-in templates produce only basic JSON reports; the MR-integration view and vulnerability dashboards are GitLab Premium / Ultimate features** (per RESEARCH §Pitfall 8;
[docs.gitlab.com/user/application_security/sast/](https://docs.gitlab.com/user/application_security/sast/)).

**Recommendation:** use the plain-CLI `.gitlab-ci-security.yml.example` shipped
by this phase. It is:

- **Free** — works on GitLab Free tier with no upgrade needed.
- **Fully featured** — every scanner runs with full CLI flags; JSON artifacts
  are uploaded normally; CI fails the pipeline on findings via `exit 1`.
- **Portable** — same shell invocations work on GitHub Actions, Jenkins, or
  any other runner with Docker. The GitHub→GitLab migration becomes a
  YAML-only swap; the underlying tools and flags don't change.

GitLab built-in templates remain a valid option **after** an upgrade to
Premium/Ultimate is decided. Until then, plain CLI is the recommended path.

---

## Quality Gate Thresholds

Per **D-07**, the Quality Gate is enforced by CI (`allow_failure: false` on
each blocking job). Suppression workflow per category is documented below;
suppression files (`.gitleaksignore`, `.trivyignore`, `.semgrepignore`) live
at repo root and are reviewed in code review.

| Finding Type | Severity | Action | Suppression Rule |
| ------------ | -------- | ------ | ---------------- |
| Secrets (gitleaks) | any | **always block, never suppress without rotation** | rotate first; suppression in `.gitleaksignore` (format `<commit-sha>:<file>:<rule>:<line>`) ONLY for verified non-production fixtures, with mandatory comment `# reason: <why> | ticket: <id> | reviewed: YYYY-MM-DD` |
| CVE (Trivy `fs` / `image`) | HIGH or CRITICAL | **block merge** | suppress in `.trivyignore` with `exp:YYYY-MM-DD` (mandatory expiry) + `# reason:` + `# ticket:` |
| SAST (Semgrep) | HIGH or CRITICAL (default `--error`) | **block merge** | suppress inline `// nosemgrep: <rule-id> reason: <why>` (preferred — co-located with code) OR `.semgrepignore` glob with comment |
| License (Trivy `fs` license) | GPL / AGPL / SSPL | **block merge** | exception requires legal review; suppression in `.trivyignore` with ticket + legal-approval reference |
| License (Trivy `fs` license) | MIT / Apache / BSD / ISC | **allow** | n/a — these are explicitly permissive |
| Container config (Trivy `config`) | HIGH or CRITICAL | **block merge** | suppression in `.trivyignore` with `exp:YYYY-MM-DD` + `# reason:` + `# ticket:` |

**Rotation policy for secrets:** if gitleaks fires (locally or in CI), rotate
the credential first, **then** rewrite history (`git filter-repo` or
`git rebase`) to remove it, **then** force-push (with team coordination).
Adding the finding to `.gitleaksignore` without rotating is a **policy
violation** — the credential is still live in git history and can be
exfiltrated by anyone with read access.

**Suppression review cadence:** every quarter, scan `.trivyignore` for entries
past their `exp:YYYY-MM-DD` date and either remediate or re-justify. This
prevents permanent drift.

---

## GitLab Migration Path

Email Platform plans to migrate from GitHub.com to self-hosted GitLab
(see project memory `project_gitlab_migration.md`). Phase 999.17 was designed
**CI-platform-portable** so that migration is a YAML-only change.

### What changes

- **CI YAML format:** GitHub Actions `.github/workflows/*.yml` →
  GitLab CI `.gitlab-ci.yml`. The `.gitlab-ci-security.yml.example` shipped
  by this phase is the migration target.
- **Branch protection:** GitHub branch protection rules → GitLab merge
  request approval rules + protected branches. Required-check identity
  changes; the *checks themselves* (jobs in the security pipeline) do not.
- **Secret push protection:** GitHub Advanced Security (paid, NOT used by
  this project — D-04 explicit) → server-side `pre-receive` hook on
  self-hosted GitLab (free, see [Server-side pre-receive Hook](#server-side-pre-receive-hook)
  below — D-04 Layer C). Self-hosted GitLab unlocks server-side enforcement
  that GitHub.com gates behind GHAS.
- **Renovate runner:** Mend Renovate GitHub App → self-hosted GitLab
  Renovate runner. Same `renovate.json` (CI-platform-portable per D-08).

### What stays the same

- **All Docker images and tag pins** — `zricethezav/gitleaks:v8.30.1`,
  `returntocorp/semgrep:1.50`, `aquasec/trivy:0.50.4`, `anchore/syft:v1.40`.
- **All scanner CLI flags** — every Docker invocation in
  `.gitlab-ci-security.yml.example` is identical to its dev-side counterpart
  in `package.json` `security:*` scripts and `scripts/security/*.sh`.
- **`renovate.json`** — same file, same rules; runner consumes it identically
  on GitHub App and self-hosted GitLab runner.
- **Dev-side hooks** (`.husky/pre-commit`, `.husky/pre-push`) — git client
  hooks, platform-agnostic.
- **Quality Gate thresholds** (D-07) — same per-finding-type rules.

### Migration steps

1. **Stand up self-hosted GitLab.** Confirm runner availability and
   network/registry access (GitLab Container Registry or external).
2. **Mirror the GitHub repo** — initial sync via `gh repo clone` →
   `git push --mirror` to GitLab origin. Lock GitHub to read-only post-mirror.
3. **Translate CI YAML.** Drop the GitHub Actions security workflow (if any
   was added during the GitHub period). Add `.gitlab-ci.yml` based on
   `.gitlab-ci-security.yml.example` (literal copy or `include:` reference).
4. **Configure protected branches + MR approval rules** in GitLab to require
   the security pipeline to pass. Mirror the GitHub branch-protection
   intent.
5. **Install the server-side `pre-receive` hook** (D-04 Layer C — see next
   section). This is the closest free-tier equivalent to GitHub Advanced
   Security's secret push protection.
6. **Switch Renovate** from the Mend GitHub App to a self-hosted GitLab
   Renovate runner (Helm chart or k8s manifest). Configure the runner with
   a GitLab project token; `renovate.json` is auto-discovered.
7. **Decommission GitHub branch protection** and archive the GitHub repo
   (or delete after audit-period retention).

Each step is independently revertible. If a step fails, revert that step
without rolling back earlier ones.

---

## Server-side pre-receive Hook

**Post-GitLab-migration only.** This section describes the **D-04 Layer C**
server-side push-protection hook. It is **NOT applicable to GitHub.com**
(GitHub does not expose pre-receive hooks to repository owners on the
managed service; only GitHub Enterprise Server does). The GitHub-period
posture per D-04 is: client-side hooks + CI required-check, with secret
push protection deferred until self-hosted GitLab is live.

This hook runs on the GitLab server **before** the ref update is accepted.
It catches secrets even when developers bypass client-side hooks with
`git push --no-verify`. Per D-04 Layer C, this is the hard
enforcement layer that the dev-side `.husky/pre-commit` is a UX layer for.

### Script template

Verbatim from RESEARCH §Code Examples (lines 752–779), cited
[docs.gitlab.com/administration/server_hooks/](https://docs.gitlab.com/administration/server_hooks/):

```bash
#!/usr/bin/env bash
# /var/opt/gitlab/gitaly/custom_hooks/pre-receive.d/10-gitleaks
# (or /opt/gitlab/embedded/service/gitlab-shell/hooks/pre-receive.d/10-gitleaks)
#
# Runs gitleaks against every push BEFORE GitLab accepts the ref update.
# Assumes gitleaks binary is on PATH for the git user.

set -euo pipefail

while read -r oldrev newrev refname; do
  # Skip branch deletions
  [ "$newrev" = "0000000000000000000000000000000000000000" ] && continue

  if ! gitleaks git --pre-commit --staged --no-banner --redact \
        --log-opts="${oldrev}..${newrev}" 2>/dev/null; then
    echo "GL-HOOK-ERR: gitleaks detected a secret in this push."
    echo "GL-HOOK-ERR: rotate the credential, then push the cleaned history."
    exit 1
  fi
done

exit 0
```

### Install instructions

1. **Confirm GitLab install layout.** Path varies between Omnibus install
   (`/var/opt/gitlab/gitaly/custom_hooks/pre-receive.d/`) and source install
   (`/opt/gitlab/embedded/service/gitlab-shell/hooks/pre-receive.d/`). Use
   the path that exists on your server.
2. **Install gitleaks binary** on the server, on the PATH for the git user.
   Pin the version to match dev-side and CI: gitleaks v8.30.1 is the
   current canonical version per phase Plans 06–08.
   ```bash
   # Example: install pinned binary into /usr/local/bin (on PATH for git user)
   curl -sSfL https://github.com/gitleaks/gitleaks/releases/download/v8.30.1/gitleaks_8.30.1_linux_x64.tar.gz \
     | tar -xz -C /usr/local/bin gitleaks
   gitleaks version  # confirm 8.30.1
   ```
3. **Place the script** at the chosen `pre-receive.d/` path with name
   `10-gitleaks` (the `10-` prefix establishes execution order if other
   hooks are added later).
4. **Make it executable.**
   ```bash
   chmod +x /var/opt/gitlab/gitaly/custom_hooks/pre-receive.d/10-gitleaks
   ```
5. **Test with a fake-secret push.** Create a branch with a deliberately
   leaked AWS-style key (e.g., `AKIA` + 16 random uppercase chars), push,
   and confirm GitLab returns the `GL-HOOK-ERR:` message and rejects the
   ref update. Then delete the test branch.
6. **Document the rejection user experience** in your contributor guide:
   developers will see the `GL-HOOK-ERR:` lines on `git push`, must rotate
   the credential, and rewrite history before re-pushing.

The `--redact` flag is mandatory in this server context — server logs are
typically aggregated and retained, and an un-redacted secret in a hook
log is itself a leak (T-99917-09-03).

---

## Renovate Activation

Phase 999.17 Plan 08 ships `renovate.json` at repo root with lean defaults
(D-08): `config:recommended`, security alerts on, `automerge: false`,
`minimumReleaseAge: "14 days"`, monorepo grouping for `apps/**` + `packages/**`,
weekly batched updates. The bot is **dormant** — config sits in the repo
until DevOps activates a runner.

### Path A — GitHub App (current GitHub period)

1. Visit the [Renovate GitHub App listing](https://github.com/apps/renovate)
   from a GitHub user/org account that has admin on this repo.
2. Click **Install** and grant access to the `email-platform` repository
   (or the org if you want Renovate on multiple repos).
3. The Renovate Mend bot will auto-discover `renovate.json` at repo root
   on its next scan cycle (typically within an hour) and open an
   onboarding PR titled `"Configure Renovate"`. Merge or close that PR
   per Renovate's prompt — the config in the repo is already final, so
   the onboarding PR can be closed without merging.
4. Subsequent runs open dependency-update PRs per the rules in
   `renovate.json` (security alerts, weekly lockfile maintenance, monorepo
   grouping).

### Path B — Self-hosted GitLab Renovate runner (post-migration)

1. **Decide deployment shape.** Options:
   - Helm chart: [renovatebot/helm-charts](https://github.com/renovatebot/helm-charts)
     `renovate` chart for k8s clusters.
   - Container: pin a specific Renovate runner SemVer tag (e.g.
     `renovate/renovate:39.x`, never an unpinned floating tag) running as
     a scheduled GitLab CI job or k8s `CronJob`.
2. **Provision a GitLab project access token** with `api`, `read_repository`,
   and `write_repository` scopes (Renovate needs to read the repo, open
   MRs, and update branches).
3. **Configure the runner** with:
   - `RENOVATE_PLATFORM=gitlab`
   - `RENOVATE_ENDPOINT=https://gitlab.<your-domain>/api/v4`
   - `RENOVATE_TOKEN=<the-project-access-token>`
   - `RENOVATE_REPOSITORIES=email-platform/email-platform` (or your group/path)
4. The runner reads `renovate.json` at repo root **identically** to the
   GitHub App — no config change needed.
5. Schedule the runner (CI scheduled pipeline or k8s `CronJob`) on the
   cadence you want (Renovate's own `schedule` rule in `renovate.json`
   handles when MRs are *opened*; the runner cadence determines when the
   bot *checks* — typical: every 1–6 hours).

### Tuning post-activation

The shipped `renovate.json` is intentionally **lean** (D-08):

- `automerge: false` — every dependency update is human-reviewed.
- Security-only alert path is the primary signal.
- Patch updates are batched weekly to limit PR/MR fan-out.

After 2–4 weeks of bot activity, DevOps + product owner should review
empirical PR/MR review burden vs risk tolerance and decide whether to
tune. Common follow-ups (deferred per CONTEXT §Deferred Ideas):

- **Selective automerge** for trusted patch updates (e.g., `@types/*`
  TypeScript-only patches with passing CI). Renovate's
  `automergeStrategy: "branch"` + `packageRules` `automerge: true` for a
  curated package list is the typical shape.
- **Custom presets** — extract the lean defaults into a shareable preset
  (`.github/renovate-config.json` or a separate org-level preset repo) if
  Renovate is adopted across multiple repos.
- **Demote `osvVulnerabilityAlerts`** if the runtime warns "experimental"
  noisily — `vulnerabilityAlerts.enabled: true` provides baseline coverage.

These tunings are **out of scope for Phase 999.17** — they require empirical
data this phase does not have.

---

## Continuous Trivy Image Rescan

**Out of scope for Phase 999.17.** Documented here so DevOps has the
follow-up captured.

### Why

Built images can develop **new** CVEs after build. The CVE feed is updated
retroactively as researchers disclose vulnerabilities — an image that
scanned clean on Monday can have a HIGH/CRITICAL finding on Friday with
no code change. CI-time image scan (Trivy `image`, post-build) is
necessary but not sufficient: production runs the same image for days or
weeks, and that image needs ongoing surveillance.

### How

Schedule a recurring Trivy `image` scan against the production image
tag(s):

```bash
# Cron / k8s CronJob shell:
docker run --rm \
  aquasec/trivy:0.50.4 \
  image --severity HIGH,CRITICAL --exit-code 1 \
  registry.<your-domain>/email-platform/<service>:<production-tag>
```

On non-zero exit, the cron alerts (email / Slack / Telegram via the
notifier service if it's wired post-phase-999.17). Coordinate
remediation: rebuild image with patched base layer, redeploy.

### Suggested cadence

- **Production images:** nightly (every UTC midnight is typical).
- **Staging images:** weekly (lighter touch; staging gets less production
  traffic, less remediation urgency).
- **Image registry retention:** keep at least 30 days of historical
  production tags so you can correlate "when did this CVE first appear
  in our deployed image?"

### What's NOT in scope here

This requires CI access to the image registry (read), an alerting
channel (email/Slack/Telegram), and a deploy pipeline that can rebuild
and roll out the patched image. None of these are shipped by Phase
999.17 — they are pre-existing infra (image registry, notifier service)
plus DevOps glue (cron schedule, alert routing). The code-side artifact
is just the Trivy invocation above.

---

*Phase 999.17 — devsecops-shift-left-security-tooling*
*See `.planning/phases/999.17-devsecops-shift-left-security-tooling/` for decision context.*

---

## Branch protection (Phase 999.18.3 FR-15)

**Required server-side configuration в GitLab Project Settings → Repository → Protected branches:**

- **`main` branch:**
  - Allowed to merge: Maintainer or Owner role only
  - Allowed to push: NO direct push (force MR-only flow)
  - Required: «Pipelines must succeed» = ON
  - Required: «All threads must be resolved» = ON
  - Required approvers: 1 (or per team policy)

- **Pipeline rule (FR-14):** all 8 security jobs (`secret-detection`, `sast`, `env-parity`, `audit`, `container-config`, `container-cve`, `license-scan`, `sbom`) MUST be `allow_failure: false` (verified в `.gitlab-ci.yml`).

**Why server-side enforcement matters (per Phase 999.18.3 LAYER-ARCHITECTURE §E.4 L4):**

Local pre-commit/pre-push hooks (`.githooks/pre-commit` + `.githooks/pre-push`) provide convenience-layer feedback. They CAN be bypassed via `git commit --no-verify`. The actual security enforcement layer = **GitLab CI required pipelines + branch protection** (canonical MAANG-aligned pattern per Atlassian + GitHub Engineering documentation, verified iter 7 of Phase 999.18.3).

**Empirical convergence:** N=5/7 verified public repos (React + Astro + Remix + Nuxt + SvelteKit) rely on CI-only enforcement; none use husky/prepare-script gating because that pattern was empirically broken (pnpm bug #7068 — see Phase 999.18.3 Iteration 6 BLOCKED state и forensic chain в 999.18.1-ADR.md Iteration 7 entry once Plan 09 lands).

**Verification post-migration:** after GitLab self-hosted migration completes (per memory `project_gitlab_migration`), validate branch protection:

```bash
# Try direct push к main — MUST fail
git push origin main:main 2>&1 | grep -qi "protected"   # expect denial

# Try MR без passing pipeline — MUST be unmergeable until pipeline green
# (Manual UI verification — no CLI gate.)
```

*Phase 999.18.3 — sub-phase Wave 2 — Plan 08*
*See `.planning/phases/999.18.3-sub-phase-wave-2-fetcher-installer-scope-mismatch-via-pnpm-p/` for decision context.*
