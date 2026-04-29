#!/usr/bin/env bash
# Phase 999.17 — pnpm-audit guard clause (only runs if pnpm-lock.yaml changed vs origin/main).
# See .planning/phases/999.17-devsecops-shift-left-security-tooling/999.17-07-PLAN.md.
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Ensure origin/main is fetchable; fail soft if not (e.g. fresh clone, network blip)
if ! git rev-parse origin/main >/dev/null 2>&1; then
  echo -e "${YELLOW}  WARN${NC}: origin/main not resolvable; attempting fetch."
  git fetch origin main --depth=1 >/dev/null 2>&1 || {
    echo -e "${YELLOW}  SKIP${NC}: origin/main unreachable — skipping SCA gate (CI is enforcement layer per D-04)."
    exit 0
  }
fi

# Guard clause — early exit 0 if lockfile unchanged (per RESEARCH §Pattern 5 + PATTERNS §SP-3)
if git diff --quiet origin/main -- pnpm-lock.yaml; then
  echo -e "${GREEN}  SKIP${NC}: pnpm-lock.yaml unchanged vs origin/main; SCA not needed."
  exit 0
fi

# Lockfile changed — run pnpm audit (requires pnpm 11.x per D-11; v9/v10 returns HTTP 410)
echo -e "${GREEN}  RUN${NC}: pnpm-lock.yaml changed; running pnpm audit --audit-level high."
exec pnpm audit --audit-level high
