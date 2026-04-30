#!/usr/bin/env bash
# Phase 999.17 — Semgrep diff scan vs origin/main (D-13 explicit composition + D-16 Docker-wrapped).
# See .planning/phases/999.17-devsecops-shift-left-security-tooling/999.17-07-PLAN.md.
# Reads ruleset IDs from .semgrep.yml `rulesets:` field (Plan 04 product).
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Verify .semgrep.yml exists (Plan 04 product)
if [ ! -f .semgrep.yml ]; then
  echo -e "${RED}  FAIL${NC}: .semgrep.yml not found at repo root (Plan 04 prerequisite missing)."
  exit 1
fi

# Resolve baseline hash (RESEARCH §Pitfall 4 — flag wants hash, not ref)
if ! git rev-parse origin/main >/dev/null 2>&1; then
  echo -e "${YELLOW}  WARN${NC}: origin/main not resolvable; attempting fetch."
  git fetch origin main --depth=1 >/dev/null 2>&1 || {
    echo -e "${YELLOW}  SKIP${NC}: origin/main unreachable — skipping Semgrep diff (CI is enforcement layer per D-04)."
    exit 0
  }
fi
BASELINE="$(git rev-parse origin/main)"

# Parse ruleset IDs from .semgrep.yml `rulesets:` field, emit --config flags
# Convention from Plan 04: each ruleset listed as `  - p/<id>` under `rulesets:` key
#
# D-5 fix: parallel RULESET_IDS array carries the bare ruleset IDs for accurate counting.
# RULESET_FLAGS contains 2 elements per ruleset (--config <id>); using ${#RULESET_FLAGS[@]}
# for the count produced "10 ruleset(s)" when 5 were configured. See RESEARCH §Pitfall 7.
RULESET_FLAGS=()
RULESET_IDS=()
while IFS= read -r ruleset_id; do
  RULESET_FLAGS+=(--config "$ruleset_id")
  RULESET_IDS+=("$ruleset_id")
done < <(grep -E '^\s+- p/' .semgrep.yml | awk '{print $2}')

# D-10: Discover custom rules from .semgrep/rules/ directory (file-per-rule convention).
# Added in Plan 06; this discovery is forward-compatible (no-op if directory empty/absent).
if [ -d .semgrep/rules ] && [ -n "$(ls -A .semgrep/rules 2>/dev/null)" ]; then
  RULESET_FLAGS+=(--config .semgrep/rules/)
  RULESET_IDS+=(".semgrep/rules/")
fi

if [ ${#RULESET_IDS[@]} -eq 0 ]; then
  echo -e "${RED}  FAIL${NC}: no rulesets parsed from .semgrep.yml (expected lines like '  - p/typescript')."
  exit 1
fi

echo -e "${GREEN}  RUN${NC}: Semgrep diff vs $BASELINE with ${#RULESET_IDS[@]} ruleset(s) (Docker-wrapped, returntocorp/semgrep:1.50)."
# D-4 fix: --metrics=off prevents phone-home that introduced exit-code non-determinism
# between pre-push hook and manual run. Note: --metrics=off does NOT disable registry
# rule download (RESEARCH §Pitfall 2) — first-time fetch still hits the network.
exec docker run --rm \
  -v "$(pwd):/repo" -w /repo \
  returntocorp/semgrep:1.50 \
  semgrep scan --metrics=off "${RULESET_FLAGS[@]}" --baseline-commit "$BASELINE" --error
