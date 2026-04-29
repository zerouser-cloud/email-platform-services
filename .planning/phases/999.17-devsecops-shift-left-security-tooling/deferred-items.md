# Phase 999.17 — Deferred Items

Items discovered during execution but out-of-scope for the current plan. Tracked here per the scope-boundary rule (executor only auto-fixes issues directly caused by the current task's changes).

## D-1: Pre-existing TS2742 in `apps/gateway/src/infrastructure/bootstrap/health/health.controller.ts:70`

**Discovered during:** Plan 999.17-11 Task 3 (`pnpm run build` smoke after strictDepBuilds gate enabled)

**Finding:** `pnpm run build` fails at `@email-platform/gateway` with:

```
src/infrastructure/bootstrap/health/health.controller.ts:70:9 - error TS2742:
The inferred type of 'readiness' cannot be named without a reference to
'../../../../../../packages/foundation/node_modules/@nestjs/terminus/dist'.
This is likely not portable. A type annotation is necessary.

70   async readiness() {
             ~~~~~~~~~

Found 1 error(s).
```

**Origin:** Pre-existing — last commit on this file is `d47792c` (Phase 999.12.1, "rename HEALTH.INDICATOR.{REDIS,RABBITMQ,POSTGRESQL} → {CACHE,MESSAGING,PERSISTENCE}"). Reproduced in the parent worktree (PARENT_BUILD_EXIT=1) BEFORE Plan 999.17-11 changes were applied. Not caused by the build-script trust gate.

**Why deferred:** Out of scope for Plan 999.17-11 (gap closure for CR-01, build-script trust). The TS2742 is a pnpm-symlink-traversal type-export issue from a different phase's refactor — separate concern, separate phase.

**Suggested next action:** Route to `/gsd:fast` or open as a Phase 999.12.1 follow-up. The fix is likely a one-liner adding an explicit return type annotation:

```typescript
async readiness(): Promise<HealthCheckResult> {
```

**Lint and post-install execution gate are unaffected** — Plan 999.17-11 acceptance criteria for those passed.

**Update 2026-04-29:** Resolved via `/gsd:fast` — commits `3a69e9f` (gateway) + `5b199bd` (auth+audience+sender+parser+notifier). Workspace typecheck now `12/12 successful`. Pre-push chain reaches semgrep step (revealed downstream issues — see D-2..D-6 below).

---

## D-2: Pre-push chain ordering blocks ALL security gates behind unrelated TS errors (was WR-03)

**Discovered during:** Manual smoke testing 2026-04-29 (`/gsd:fast` TS2742 follow-up).

**Finding:** `package.json#scripts.security:pre-push` is a `&&`-chain:
```
typecheck && env-parity && semgrep-diff && audit-if-lock-changed && trivy-config-if-changed
```
Any failure (especially in `typecheck`, which is QUALITY axis, not SECURITY) prevents downstream security gates from running. WR-03 was filed as "advisory" in REVIEW.md but elevated to **operational blocker** by manual reproduction: pre-existing TS2742 in any service silently disables semgrep / pnpm-audit / trivy gates locally. CI is currently the only backstop, and `.gitlab-ci-security.yml.example` is a template (not yet active). Pre-push hook also fires on `git push --delete` (does not distinguish push-content vs push-delete), unnecessary friction for branch cleanup.

**Architectural framing (per user 2026-04-29 discussion):**
- **Quality** axis: ESLint, Prettier, tsc — feedback for developer, IDE-bound (must use native node_modules path so IDE plugin and hook agree)
- **Security** axis: gitleaks, semgrep, trivy, pnpm audit, build-trust gate — independent of quality, fail-closed by design, Docker-pinned images
- **Hygiene** axis: env-parity, etc. — third axis; hygiene checks shouldn't be tangled into either of above
- **Layer 3 (CI)**: must duplicate everything (`--no-verify` bypass-able locally, un-bypass-able server-side)

**Suggested closure:** 999.17.1 sub-phase — `quality-security-decouple-and-dockerization`. Split `package.json` script namespaces (`quality:*` / `security:*` / `hygiene:*`), independent `.husky/pre-{commit,push}` orchestration, optional `--no-verify` patterns for delete-only push.

---

## D-3: Semgrep ruleset gap — silent fail-open #3 (post-CR-02 finding)

**Discovered during:** Manual smoke testing 2026-04-29 against synthetic eval-injection fixture.

**Finding:** Plan 04 chose 5 registry rulesets (`p/typescript`, `p/javascript`, `p/nodejs`, `p/owasp-top-ten`, `p/r2c-security-audit`). Ran 79 rules on 1 file (`apps/auth/src/test/semgrep-fixture.ts` containing `eval(input.code)` direct call) — **0 findings**. Rulesets do not include eval-injection detection out of the box. Same pattern as CR-01 (build-trust silently warning-only) and CR-02 (gitleaks regex unanchored): "положили tooling, не доказали что работает".

**Empirical evidence:**
```
$ docker run --rm -v $(pwd):/repo returntocorp/semgrep:1.50 \
    semgrep scan --config p/typescript --config p/javascript --config p/nodejs \
                 --config p/owasp-top-ten --config p/r2c-security-audit \
                 apps/auth/src/test/semgrep-fixture.ts
Ran 79 rules on 1 file: 0 findings.
```

**Suggested closure:** 999.17.1 — either add `p/security-audit` (broader, would catch eval), or move to `--config auto` (registry's curated set), or write project-specific rules covering Email-Platform-relevant injection sinks. Decision via discuss-phase D-NN.

---

## D-4: Semgrep non-determinism — different exit codes pre-push vs manual

**Discovered during:** Manual smoke testing 2026-04-29.

**Finding:** Same `bash scripts/security/semgrep-diff.sh` produces different outcomes:
- **Within pre-push hook:** exit 2 (fatal), output stops at METRICS line, no Scan Status block.
- **Manual run from same working tree:** exit 0, full Scan Status, "Ran 79 rules on 1 file: 0 findings."

Difference might be: Docker daemon cold-start, race on image pull, env-vars not propagated through husky→pnpm→bash→docker chain, or `--metrics=off` not set (semgrep tries to reach semgrep.dev, unstable in some network contexts).

**Suggested closure:** 999.17.1 — add `--metrics=off`, optionally pre-pull images in setup hook, investigate husky env-var propagation.

---

## D-5: Bash counter bug in `scripts/security/semgrep-diff.sh`

**Discovered during:** Manual smoke testing 2026-04-29.

**Finding:** Output reports "10 ruleset(s)" when 5 rulesets are configured. Cause:
```bash
RULESET_FLAGS+=(--config "$ruleset_id")  # adds 2 array elements
echo "with ${#RULESET_FLAGS[@]} ruleset(s)"  # counts 2 × N
```
Cosmetic only — actual semgrep invocation passes correct configs.

**Suggested closure:** Trivial fix — `${#RULESET_FLAGS[@]} / 2` or restructure to count IDs separately. Can fold into 999.17.1 or `/gsd:fast` opportunistically.

---

## D-6: Phase 999.17 systemic pattern — "tooling installed, not proven"

**Meta-finding:** Of 5 security gates declared by Phase 999.17 goal, **3 had silent fail-open at delivery**:

| Gate | Initial state | Closed by |
|------|---------------|-----------|
| CR-01 Build-trust | warning-only (allowBuilds without strictDepBuilds) | Plan 11 (✓) |
| CR-02 Gitleaks | unanchored allowlist regex | Plan 12 (✓) |
| D-3 Semgrep | rulesets too narrow, miss eval-injection | 999.17.1 (pending) |
| Trust gate | (closed by Plan 11 above) | — |
| Trivy/Audit | not yet manually verified end-to-end (chain blocked at D-2) | 999.17.1 verification |

Pattern: the original phase scope ("install + configure security tooling") did not include "**prove each tool catches what it claims**". Per `feedback_phase_completeness` skill: this is **systemic gap**, full-cycle 999.17.1 sub-phase is the right size-matched response. Should include:
1. Decouple quality / security / hygiene axes (D-2)
2. Self-test harness with positive + negative fixtures per gate (project-fixtures-in-code, isolated vuln-sandbox subdir for trivy fs)
3. Expand semgrep rulesets / write project-specific rules (D-3)
4. Investigate Docker boundary — full Docker for security tools, native for quality tools that IDE shares (D-2 architectural framing)
5. Smoke-test at execution-phase verifier level, not just config grep
6. Fix cosmetic bash counter bug (D-5)
7. `--metrics=off` + Docker pre-pull setup (D-4)

CR-01 + CR-02 closed by gap-closure plans 11+12 are *necessary* but *insufficient* — phase is structurally complete (12/12 plans, 14/14 verifier truths) but **operational posture remains weaker than goal claims** until 999.17.1 closes the systemic gap.
