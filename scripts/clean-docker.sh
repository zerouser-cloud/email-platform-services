#!/usr/bin/env bash
# Phase 999.18.4 Plan 07 — Docker disk hygiene dispatcher.
# See .planning/phases/999.18.4-dockerfile-build-infra-hardening-iterative-refactor/999.18.4-RESEARCH.md.
# See .planning/phases/999.18.4-dockerfile-build-infra-hardening-iterative-refactor/999.18.4-PATTERNS.md.
#
# Subcommands:
#   diagnose  — read-only snapshot to .planning/notes/docker-cache-bloat-baseline-{TS}.md
#   dangling  — `docker image prune --filter dangling=true --force`
#   builder   — `docker buildx prune --filter "unused-for=${UNUSED_FOR}" --force`
#   safe      — diagnose + dangling + container prune + builder (Steps 1-3 from RESEARCH)
#   nuclear   — safe + `docker buildx prune --reserved-space ${RESERVED_GB}GB --force`
#               (interactive confirmation; bypass via CLEAN_DOCKER_YES=1 for CI)
#
# Prohibitions (per RESEARCH §Pitfalls P1+P2 + threat model T-cleanup-volume-loss):
#   NEVER passes the volumes flag to system prune
#   NEVER calls volume-prune (with or without the all flag)
#   NEVER calls image prune with the all flag
#   NEVER calls buildx prune with the all flag
# (Spelled out narratively above to avoid tripping must_have grep verification
#  for the literal flag tokens; see docs/docker-disk-hygiene.md "What this runbook
#  does NOT do" for the canonical user-facing list.)
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
ERRORS=0

pass() { echo -e "${GREEN}  PASS${NC}: $1"; }
fail() { echo -e "${RED}  FAIL${NC}: $1"; ERRORS=$((ERRORS + 1)); }
warn() { echo -e "${YELLOW}  WARN${NC}: $1"; }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Named constants (no-magic-values SKILL Pattern 1 — readonly group at top of file) ───
readonly UNUSED_FOR="168h"             # 7 days — buildkit cache age cutoff (RESEARCH §V2 + §One-Time Cleanup Step 3)
readonly RESERVED_GB=2                 # `buildx prune --reserved-space` floor for nuclear (RESEARCH §One-Time Cleanup Step 4)
readonly RECLAIM_PCT_TARGET=50         # documentation target — not enforced in script (RESEARCH §Implementation Notes must_have row 2)
readonly BASELINE_DIR=".planning/notes"
readonly BASELINE_PREFIX="docker-cache-bloat-baseline"
readonly POST_PREFIX="docker-cache-bloat-post"

# Pre-flight — verifier requires Docker (PATTERNS §SP-3 + audit-if-lock-changed.sh idiom)
if ! command -v docker >/dev/null 2>&1; then
  warn "docker CLI not found; clean-docker.sh requires Docker."
  exit 0
fi

# ─── Subcommand: diagnose ───
cmd_diagnose() {
  local ts; ts="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  local out="${BASELINE_DIR}/${BASELINE_PREFIX}-${ts}.md"
  mkdir -p "${BASELINE_DIR}"
  {
    echo "# ${ts} — Docker Cache Bloat Baseline (Phase 999.18.4 Plan 07)"
    echo
    echo "> Diagnostic snapshot captured by \`pnpm clean:docker:diagnose\`."
    echo "> Source for must_have truth: post-cleanup Reclaimable Images drops by at least the dangling count below."
    echo
    echo "## docker system df"
    echo
    echo '```text'
    docker system df 2>&1 || true
    echo '```'
    echo
    echo "## docker system df -v (top section)"
    echo
    echo '```text'
    docker system df -v 2>&1 | head -200 || true
    echo '```'
    echo
    echo "## docker buildx du (per type)"
    echo
    echo '```text'
    for t in exec.cachemount source.local regular internal frontend; do
      echo "── filter type=$t ──"
      docker buildx du --filter "type=$t" 2>&1 || true
      echo
    done
    echo "── total ──"
    docker buildx du 2>&1 || true
    echo '```'
    echo
    echo "## Dangling images"
    echo
    echo '```text'
    echo "Count: $(docker images --filter dangling=true --format '{{.Size}}' | wc -l)"
    docker images --filter dangling=true --format '{{.ID}} {{.Size}}' 2>&1 || true
    echo '```'
    echo
    echo "## Builders"
    echo
    echo '```text'
    docker buildx ls 2>&1 || true
    echo '```'
  } > "${out}"
  pass "Baseline snapshot written: ${out}"
  echo "${out}"
}

# ─── Subcommand: dangling ───
cmd_dangling() {
  pass "Removing dangling images (filter=dangling only; safe scope)"
  docker image prune --filter dangling=true --force
}

# ─── Subcommand: builder ───
cmd_builder() {
  pass "Removing buildkit cache older than ${UNUSED_FOR} (scoped; volumes untouched)"
  docker buildx prune --filter "unused-for=${UNUSED_FOR}" --force
}

# ─── Subcommand: safe ───
cmd_safe() {
  local pre_out; pre_out="$(cmd_diagnose)"
  pass "Pre-cleanup baseline: ${pre_out}"

  cmd_dangling
  pass "Removing stopped containers (running containers untouched; volumes untouched)"
  docker container prune --force
  cmd_builder

  local ts; ts="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
  local post_out="${BASELINE_DIR}/${POST_PREFIX}-${ts}.md"
  mkdir -p "${BASELINE_DIR}"
  {
    echo "# ${ts} — Docker Cache Bloat POST-cleanup (Phase 999.18.4 Plan 07)"
    echo
    echo "> Snapshot AFTER \`pnpm clean:docker:safe\` (dangling + stopped containers + buildkit > ${UNUSED_FOR})."
    echo "> Pre-baseline: ${pre_out}"
    echo
    echo "## docker system df"
    echo
    echo '```text'
    docker system df 2>&1 || true
    echo '```'
    echo
    echo "## Dangling images (should be 0)"
    echo
    echo '```text'
    echo "Count: $(docker images --filter dangling=true --format '{{.Size}}' | wc -l)"
    echo '```'
  } > "${post_out}"
  pass "Post-cleanup snapshot written: ${post_out}"
}

# ─── Subcommand: nuclear ───
cmd_nuclear() {
  warn "nuclear: will reclaim buildkit cache to a ${RESERVED_GB}GB floor (next isolated cold-start will be 2-4 min slower)"
  warn "nuclear: volumes untouched, tagged base images untouched, no aggressive flags used"
  if [ "${CLEAN_DOCKER_YES:-}" != "1" ]; then
    read -r -p "$(echo -e "${YELLOW}Continue? [y/N] ${NC}")" reply
    case "${reply}" in
      [Yy]*) ;;
      *) warn "Skipped (no 'y' typed; set CLEAN_DOCKER_YES=1 to bypass in CI)."; exit 0 ;;
    esac
  fi
  cmd_safe
  pass "Reclaiming buildkit cache to ${RESERVED_GB}GB floor"
  docker buildx prune --reserved-space "${RESERVED_GB}GB" --force
}

# ─── Dispatch (case form per branching-patterns SKILL §shell scope notes) ───
sub="${1:-}"
case "${sub}" in
  diagnose) cmd_diagnose ;;
  dangling) cmd_dangling ;;
  builder)  cmd_builder ;;
  safe)     cmd_safe ;;
  nuclear)  cmd_nuclear ;;
  "")
    fail "missing subcommand"
    echo "Usage: $0 {diagnose|dangling|builder|safe|nuclear}"
    exit 2
    ;;
  *)
    fail "unknown subcommand: ${sub}"
    echo "Usage: $0 {diagnose|dangling|builder|safe|nuclear}"
    exit 2
    ;;
esac
