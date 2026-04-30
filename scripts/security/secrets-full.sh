#!/usr/bin/env bash
# Phase 999.17.1 — gitleaks full-repo secret scan (W2 fix per checker).
# Sources scripts/security/_versions.sh for $GITLEAKS_IMAGE so the tag lives in ONE place.
# Invoked from package.json#scripts.security:secrets-full and via security:scan meta.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# shellcheck source=./_versions.sh
. "$(dirname "${BASH_SOURCE[0]}")/_versions.sh"

exec docker run --rm \
  -v "$(pwd):/repo" -w /repo \
  "$GITLEAKS_IMAGE" \
  dir /repo --no-banner
