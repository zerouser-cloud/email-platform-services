#!/usr/bin/env bash
# Phase 999.18.2 Wave 0 — verify injection-extinct (5-cycle install+build → identical digests).
# See .planning/phases/999.18.2-implementation-cluster-execute-migration-runbook-from-phase-/999.18.2-01-PLAN.md.
# RESEARCH §11.2 REQ-BUILD-02 (5-cycle injection-extinct check).
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
echo " Phase 999.18.2 Wave 0 — injection-extinct verifier (5 cycles)"
echo "============================================================"

# Early-exit guards — verifier requires both Docker AND pnpm CLIs.
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}  SKIP${NC}: docker CLI not found; verifier requires Docker."
  exit 0
fi
if ! command -v pnpm >/dev/null 2>&1; then
  echo -e "${YELLOW}  SKIP${NC}: pnpm CLI not found; verifier requires pnpm."
  exit 0
fi

# CLI args — single representative service (full 6-svc loop not needed для injection-staleness check).
SVC="${1:-auth}"

# Cleanup на exit (T-999.18.2-W0-01 — quote all expansions, no eval).
DIGEST_PREFIX="/tmp/verify-injection-extinct-$$"
cleanup() {
  rm -f "${DIGEST_PREFIX}"-cycle-*.txt
}
trap cleanup EXIT

echo "Service: $SVC"
echo

# 5 sequential cycles — каждая: pnpm install --frozen-lockfile + docker build + digest capture.
for i in 1 2 3 4 5; do
  echo "─── Cycle $i ───"

  if ! pnpm install --frozen-lockfile; then
    fail "Cycle $i: pnpm install --frozen-lockfile failed (pre-W2 baseline broken — verify manually)"
    exit 1
  fi

  if ! docker buildx build --no-cache --load \
      --build-arg APP_NAME="$SVC" \
      -f infra/docker/app.Dockerfile -t "test-injection:$i" .; then
    fail "Cycle $i: docker buildx build failed"
    exit 1
  fi

  docker image inspect "test-injection:$i" --format '{{.Id}}' > "${DIGEST_PREFIX}-cycle-$i.txt"
  echo "  Cycle $i digest: $(cat "${DIGEST_PREFIX}-cycle-$i.txt")"
done

echo
echo "─── Digest equality assertion ───"

FIRST="$(cat "${DIGEST_PREFIX}-cycle-1.txt")"
echo "Reference (cycle 1): $FIRST"

for i in 2 3 4 5; do
  CURRENT="$(cat "${DIGEST_PREFIX}-cycle-$i.txt")"
  if [ "$CURRENT" != "$FIRST" ]; then
    fail "Cycle $i digest differs from cycle 1: $CURRENT vs $FIRST"
  else
    pass "Cycle $i matches cycle 1"
  fi
done

if [ "$ERRORS" -eq 0 ]; then
  echo
  echo -e "${GREEN}INJECTION-EXTINCT${NC}: all 5 cycles produced identical image digests."
fi

exit "$ERRORS"
