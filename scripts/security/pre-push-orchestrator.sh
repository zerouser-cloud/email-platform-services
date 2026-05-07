#!/usr/bin/env bash
# Phase 999.17.1 — pre-push parallel orchestrator (D-2 decoupling).
# See .planning/phases/999.17.1-quality-security-decouple-and-prove-fixtures/.
#
# Husky orchestration role (D-14): this script is the body of the .husky/pre-push
# hook (<30s budget). The .husky/pre-commit hook (<5s budget) handles the
# decoupled quality:staged + security:secrets-staged pair (also D-14, D-18).
#
# Replaces the legacy &&-chain `pnpm run security:pre-push` (D-17) with three
# independent axes running IN PARALLEL with collect-all semantics (D-16):
#   - quality  (lint + typecheck + format)
#   - security (production scan + verify-if-changed)
#   - hygiene  (env-parity)
# Quality typecheck failure does NOT block security gates — the core D-2 motivation.
#
# Delete-only push detection (D-19): if all refs have 40-zero local-sha, exit 0
# without running checks (cleanup workflow ergonomics; CI is enforcement layer).
#
# Skill alignment:
#   - branching-patterns: declare -A dispatch (no switch/case)
#   - no-magic-values: ZEROS constant, AXES dispatch table
#   - feedback_use_package_scripts: each axis dispatches via `pnpm run`

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# ============================================================================
# Delete-only push detection (D-19, D-20).
# Pre-push hook stdin format (git docs): <local-ref> <local-sha> <remote-ref> <remote-sha>
# All-zero local-sha => deletion.
# ============================================================================
readonly ZEROS="0000000000000000000000000000000000000000"
LINE_COUNT=0
ALL_DELETES=true

while read -r local_ref local_sha remote_ref remote_sha; do
  LINE_COUNT=$((LINE_COUNT + 1))
  if [ "$local_sha" != "$ZEROS" ]; then
    ALL_DELETES=false
  fi
done

# CRITICAL: husky v9 init.sh may consume stdin (RESEARCH §Pitfall 3).
# Guard with LINE_COUNT > 0: only treat as all-delete if we actually saw input.
# Empty stdin => fall through to orchestrator (conservative full chain).
if [ "$LINE_COUNT" -gt 0 ] && [ "$ALL_DELETES" = "true" ]; then
  echo -e "${GREEN}[INFO]${NC} Delete-only push detected — skipping pre-push checks (D-19)."
  exit 0
fi

# ============================================================================
# Parallel collect-all dispatch (D-16).
# branching-patterns skill: declare -A dispatch over switch/case.
# Each axis is a separate background subshell; we capture exit codes per-PID
# via `wait $pid; status=$?` (RESEARCH §Pitfall 5: wait under set -e does NOT
# auto-fail on backgrounded errors).
# ============================================================================
declare -A AXES=(
  [quality]="pnpm run quality:check"
  [security]="pnpm run security:scan && pnpm run security:verify-if-changed"
  [hygiene]="pnpm run hygiene:check"
)

declare -A PIDS=()
declare -A EXITS=()

LOG_DIR="$PROJECT_ROOT/logs/pre-push"
mkdir -p "$LOG_DIR"

echo "============================================================"
echo " Phase 999.17.1 — pre-push parallel orchestrator (3 axes)"
echo "============================================================"

for axis in "${!AXES[@]}"; do
  echo -e "${YELLOW}[START]${NC} $axis"
  bash -c "${AXES[$axis]}" > "$LOG_DIR/${axis}.log" 2>&1 &
  PIDS[$axis]=$!
done

# Wait per-PID; capture exit code (set -e does NOT abort us here per Pitfall 5).
for axis in "${!PIDS[@]}"; do
  if wait "${PIDS[$axis]}"; then
    EXITS[$axis]=0
  else
    EXITS[$axis]=$?
  fi
done

# ============================================================================
# Aggregate exit codes (collect-all: ANY non-zero => final non-zero).
# ============================================================================
final=0
for axis in "${!EXITS[@]}"; do
  status=${EXITS[$axis]}
  if [ "$status" -ne 0 ]; then
    final=1
    echo -e "${RED}[FAIL]${NC} $axis exit=$status — see $LOG_DIR/${axis}.log"
    # Surface tail of failing log for fast triage.
    echo "----- last 20 lines of $axis log -----"
    tail -20 "$LOG_DIR/${axis}.log" || true
    echo "----- end of $axis log -----"
  else
    echo -e "${GREEN}[ OK ]${NC} $axis"
  fi
done

if [ "$final" -eq 0 ]; then
  echo -e "${GREEN}[OK]${NC} All 3 axes passed."
else
  echo -e "${RED}[FAIL]${NC} Pre-push blocked. Fix failures above or use --no-verify (CI is enforcement layer)."
fi

exit $final
