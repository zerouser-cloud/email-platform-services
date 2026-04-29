#!/usr/bin/env bash
# Phase 999.17 — Trivy config guard clause (only runs if Dockerfile/compose changed vs origin/main).
# See .planning/phases/999.17-devsecops-shift-left-security-tooling/999.17-07-PLAN.md.
# Trivy mode = config (D-06; static scan, no CVE feed required).
# Docker-wrapped per D-16 + D-14 (aquasec/trivy:0.50 — major.minor pin).
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# Ensure origin/main is fetchable; fail soft if not
if ! git rev-parse origin/main >/dev/null 2>&1; then
  echo -e "${YELLOW}  WARN${NC}: origin/main not resolvable; attempting fetch."
  git fetch origin main --depth=1 >/dev/null 2>&1 || {
    echo -e "${YELLOW}  SKIP${NC}: origin/main unreachable — skipping Trivy config gate (CI is enforcement layer per D-04)."
    exit 0
  }
fi

# Guard clause — early exit 0 if no infra files changed
if git diff --quiet origin/main -- 'Dockerfile' 'infra/docker/**' 'infra/docker-compose*.yml'; then
  echo -e "${GREEN}  SKIP${NC}: no Dockerfile/compose changes vs origin/main; Trivy config not needed."
  exit 0
fi

echo -e "${GREEN}  RUN${NC}: infra files changed; running Trivy config (Docker-wrapped, aquasec/trivy:0.50)."
exec docker run --rm \
  -v "$(pwd):/repo" -w /repo \
  aquasec/trivy:0.50 \
  config --severity HIGH,CRITICAL --exit-code 1 .
