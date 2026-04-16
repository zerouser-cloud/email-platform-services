#!/usr/bin/env bash
# Phase 24.1 Wave 0 — env-file key parity check.
# See .planning/phases/24.1-.../24.1-VALIDATION.md § HARD-07.
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
echo " Phase 24.1 — env-file key parity (.env, .env.docker, .env.docker.example)"
echo "============================================================"

# Extract UPPER_SNAKE_CASE keys from KEY=VALUE lines, ignoring comments and blank lines.
keys_of() {
  grep -oE '^[A-Z][A-Z0-9_]*=' "$1" 2>/dev/null | sed 's/=$//' | sort -u
}

compare() {
  local a="$1"
  local b="$2"
  if [ ! -f "$a" ]; then
    warn "$a missing — skipping"
    return 0
  fi
  if [ ! -f "$b" ]; then
    warn "$b missing — skipping"
    return 0
  fi
  if diff <(keys_of "$a") <(keys_of "$b") > /dev/null; then
    pass "$a vs $b: keys match"
  else
    fail "$a vs $b: key drift"
    echo "    --- keys only in $a ---"
    comm -23 <(keys_of "$a") <(keys_of "$b") | sed 's/^/      /'
    echo "    --- keys only in $b ---"
    comm -13 <(keys_of "$a") <(keys_of "$b") | sed 's/^/      /'
  fi
}

compare .env .env.docker
compare .env.docker .env.docker.example

exit $ERRORS
