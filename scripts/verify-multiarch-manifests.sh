#!/usr/bin/env bash
# Phase 999.18.2 Wave 0 — verify multi-arch manifests (linux/amd64 + linux/arm64 entries).
# See .planning/phases/999.18.2-implementation-cluster-execute-migration-runbook-from-phase-/999.18.2-01-PLAN.md.
# RESEARCH §11.2 REQ-MULTIARCH-01 (multi-arch manifest assertion).
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
echo " Phase 999.18.2 Wave 0 — multi-arch manifest verifier"
echo "============================================================"

# Early-exit guard — verifier requires Docker CLI.
if ! command -v docker >/dev/null 2>&1; then
  echo -e "${YELLOW}  SKIP${NC}: docker CLI not found; verifier requires Docker."
  exit 0
fi

# Required CLI arg — fail-loud если image не передан (T-999.18.2-W0-01 mitigation).
IMAGE="${1:?usage: pnpm verify:multiarch <full-image-ref> (e.g. ghcr.io/owner/email-platform-auth:dev-latest)}"

echo "Image: $IMAGE"
echo

# Inspect manifest list — output is human-readable digest+platform table from buildx.
if ! MANIFEST="$(docker buildx imagetools inspect "$IMAGE" 2>&1)"; then
  fail "manifest inspect failed for $IMAGE"
  echo "$MANIFEST"
  exit 1
fi

echo "─── Manifest dump ───"
echo "$MANIFEST"
echo

# Двойная assertion: linux/amd64 + linux/arm64 platform entries должны присутствовать.
if echo "$MANIFEST" | grep -qE 'linux/amd64'; then
  pass "linux/amd64 entry found in $IMAGE manifest"
else
  fail "linux/amd64 entry MISSING from $IMAGE manifest"
fi

if echo "$MANIFEST" | grep -qE 'linux/arm64'; then
  pass "linux/arm64 entry found in $IMAGE manifest"
else
  fail "linux/arm64 entry MISSING from $IMAGE manifest"
fi

if [ "$ERRORS" -eq 0 ]; then
  echo
  echo -e "${GREEN}MULTI-ARCH OK${NC}: $IMAGE manifest list contains linux/amd64 + linux/arm64."
fi

exit "$ERRORS"
