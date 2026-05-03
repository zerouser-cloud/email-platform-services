#!/usr/bin/env bash
# Phase 999.18.2 Wave 0 — verify per-service entry-point smoke (require('./dist/main.js') loop).
# See .planning/phases/999.18.2-implementation-cluster-execute-migration-runbook-from-phase-/999.18.2-01-PLAN.md.
# RESEARCH §11.2 REQ-BUILD-03 (per-service entry-point smoke loop).
#
# Note: this is a STRUCTURAL smoke (does the compiled entry-point require()-load без
# syntax/import error?), NOT a runtime smoke. Runtime smoke (boot + listen + health
# probe) lives в `pnpm start:native|isolated` per `runtime-smoke-verification` skill.
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

echo "============================================================"
echo " Phase 999.18.2 Wave 0 — per-service entry-point smoke verifier"
echo "============================================================"

# Early-exit guard — verifier requires Docker CLI.
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}  SKIP${NC}: docker CLI not found; verifier requires Docker."
  exit 0
fi

# Service list discovery via `apps/*/` glob (every dir под apps/ = service).
SERVICES=()
for dir in apps/*/; do
  SERVICES+=("$(basename "$dir")")
done

if [ "${#SERVICES[@]}" -eq 0 ]; then
  fail "No services discovered under apps/* — repository layout broken?"
  exit 1
fi

echo "Services discovered: ${SERVICES[*]}"
echo

# Per-service build + structural smoke loop.
for SVC in "${SERVICES[@]}"; do
  echo "─── Building $SVC ───"

  if docker buildx build --load \
      --build-arg APP_NAME="$SVC" \
      -f infra/docker/app.Dockerfile -t "smoke-test:$SVC" .; then
    pass "$SVC build OK"
  else
    fail "$SVC build FAILED"
    continue
  fi

  echo "─── Smoke-running $SVC (require('./dist/main.js')) ───"
  # Distroless base ships без shell — invoke node directly via --entrypoint override.
  # `node -e "require('./dist/main.js')"` evaluates the entry point: returns 0 если
  # require() resolves without import/syntax error, returns non-zero otherwise.
  # NestJS bootstrap is async — process completes/keeps running depending on listeners;
  # `head -5` truncates output, exit status is captured via pipefail.
  if docker run --rm --entrypoint node "smoke-test:$SVC" -e "require('./dist/main.js')" 2>&1 | head -5; then
    pass "$SVC smoke OK (require() succeeded)"
  else
    fail "$SVC smoke FAILED (require() error)"
  fi
done

echo
if [ "$ERRORS" -eq 0 ]; then
  echo -e "${GREEN}PER-SERVICE SMOKE OK${NC}: all ${#SERVICES[@]} services load entry-point cleanly."
else
  echo -e "${RED}PER-SERVICE SMOKE FAILED${NC}: $ERRORS service(s) failed structural check."
fi

exit "$ERRORS"
