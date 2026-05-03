#!/usr/bin/env bash
# Phase 999.18.2 Wave 0 — verify image-determinism (двойной buildx + digest diff).
# See .planning/phases/999.18.2-implementation-cluster-execute-migration-runbook-from-phase-/999.18.2-01-PLAN.md.
# RESEARCH §11.5 lines 1319-1330 (build determinism proof recipe).
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
echo " Phase 999.18.2 Wave 0 — image-determinism verifier"
echo "============================================================"

# Early-exit guard — verifier requires Docker CLI (per audit-if-lock-changed.sh pattern).
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}  SKIP${NC}: docker CLI not found; verifier requires Docker."
  exit 0
fi

# CLI args — service name + git ref to check determinism against.
SVC="${1:-auth}"
SHA="${2:-HEAD}"

# Capture original HEAD ref для restore при exit (T-999.18.2-W0-04 mitigation —
# never leave HEAD detached если script crashes mid-run).
ORIGINAL_REF="$(git symbolic-ref --short HEAD 2>/dev/null || git rev-parse HEAD)"

DIGEST1="/tmp/verify-image-determinism-digest1.$$"
DIGEST2="/tmp/verify-image-determinism-digest2.$$"

cleanup() {
  rm -f "$DIGEST1" "$DIGEST2"
  if [ -n "${ORIGINAL_REF:-}" ]; then
    git checkout "$ORIGINAL_REF" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "Service:      $SVC"
echo "Git ref:      $SHA"
echo "Original HEAD: $ORIGINAL_REF"
echo

# Switch to target ref (deterministic source baseline для двойного билда).
git checkout "$SHA"

echo "─── Build #1 ───"
docker buildx build --no-cache --load \
    --build-arg APP_NAME="$SVC" \
    -f infra/docker/app.Dockerfile -t "test-determinism:1" .
docker image inspect "test-determinism:1" --format '{{.Id}}' > "$DIGEST1"

echo "─── Build #2 ───"
docker buildx build --no-cache --load \
    --build-arg APP_NAME="$SVC" \
    -f infra/docker/app.Dockerfile -t "test-determinism:2" .
docker image inspect "test-determinism:2" --format '{{.Id}}' > "$DIGEST2"

echo
echo "Digest #1: $(cat "$DIGEST1")"
echo "Digest #2: $(cat "$DIGEST2")"
echo

if diff -q "$DIGEST1" "$DIGEST2" >/dev/null; then
  pass "Image digests match — build is DETERMINISTIC for $SVC@$SHA"
  echo -e "${GREEN}DETERMINISTIC${NC}"
  exit 0
else
  fail "Image digests DIVERGE — build is NON-DETERMINISTIC for $SVC@$SHA"
  echo -e "${RED}NON-DETERMINISTIC${NC}"
  diff "$DIGEST1" "$DIGEST2" || true
  exit 1
fi
