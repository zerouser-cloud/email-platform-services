#!/usr/bin/env bash
# Phase 24.1 Wave 0 — check for non-null assertions (config.get<T>(KEY)!) in HTTP-client files.
# See .planning/phases/24.1-.../24.1-VALIDATION.md § HARD-03.
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
ERRORS=0

pass() { echo -e "${GREEN}  PASS${NC}: $1"; }
fail() { echo -e "${RED}  FAIL${NC}: $1"; ERRORS=$((ERRORS + 1)); }

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "============================================================"
echo " Phase 24.1 — no non-null assertion audit (HTTP surface)"
echo "============================================================"

PATHS=(
  "apps/notifier/src/infrastructure/clients/telegram"
  "apps/parser/src/infrastructure/clients/appstorespy"
  "apps/sender/src/infrastructure/clients/cloud-functions"
  "apps/gateway/src/infrastructure/clients/http-smoke"
  "apps/gateway/src/test/http-smoke"
  "packages/foundation/src/external/http"
)

EXISTING=()
for p in "${PATHS[@]}"; do
  if [ -d "$p" ]; then EXISTING+=("$p"); fi
done

if [ ${#EXISTING[@]} -eq 0 ]; then
  fail "No target paths exist"
  exit 1
fi

# Match: config.get<TypeName>(anything)!
if grep -rnE 'config\.get<[a-zA-Z_]+>\([^)]+\)[!]' "${EXISTING[@]}" 2>/dev/null; then
  fail "non-null assertions (config.get<T>(K)!) found in changed files"
else
  pass "no non-null assertions in HTTP surface"
fi

exit $ERRORS
