#!/usr/bin/env bash
# Phase 999.17.1 — gitleaks staged-only secret scan (W2 fix per checker).
# Sources scripts/security/_versions.sh for $GITLEAKS_IMAGE so the tag lives in ONE place.
# Invoked from package.json#scripts.security:secrets-staged AND from .husky/pre-commit (Plan 04).

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# shellcheck source=./_versions.sh
. "$(dirname "${BASH_SOURCE[0]}")/_versions.sh"

exec docker run --rm \
  -v "$(pwd):/repo" -w /repo \
  "$GITLEAKS_IMAGE" \
  git --pre-commit --staged --no-banner
