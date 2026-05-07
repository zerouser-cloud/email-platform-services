#!/usr/bin/env bash
# Phase 999.17.1 — gitleaks full-repo secret scan (W2 fix per checker).
# Sources scripts/security/_versions.sh for $GITLEAKS_IMAGE so the tag lives in ONE place.
# Invoked from package.json#scripts.security:secrets-full and via security:scan meta.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$PROJECT_ROOT"

# shellcheck source=./_versions.sh
. "$(dirname "${BASH_SOURCE[0]}")/_versions.sh"

# Phase 999.17.2 (D-04 / AM-02): use `git` mode (scans git-tracked content via
# `git log -p`), NOT `dir` (which would scan filesystem and pick up untracked
# .pnpm-store/, .claude/worktrees/, etc — 111 false-positives in 999.17.1 UAT).
exec docker run --rm \
  -v "$(pwd):/repo" -w /repo \
  "$GITLEAKS_IMAGE" \
  git /repo --no-banner
