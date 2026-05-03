#!/usr/bin/env bash
# bin/setup-gsd.sh — install the GSD framework at the version pinned in .gsd-version.
#
# Run this once after cloning the repo, or after bumping .gsd-version.
# The framework files (.claude/get-shit-done/, .claude/commands/gsd/, etc.) are
# gitignored — this script restores them at the project's pinned version.
#
# Tracked customisations (.claude/skills/, .claude/settings.json, CLAUDE.md,
# .planning/) are project-owned and survive any reinstall.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -f .gsd-version ]; then
  echo "ERROR: .gsd-version not found at $ROOT" >&2
  echo "Expected a file containing the pinned GSD framework version (e.g. '1.38.5')." >&2
  exit 1
fi

VERSION="$(tr -d '[:space:]' < .gsd-version)"

if [ -z "$VERSION" ]; then
  echo "ERROR: .gsd-version is empty" >&2
  exit 1
fi

echo "Installing GSD framework v${VERSION} (Claude Code, local scope)..."
npx -y "get-shit-done-cc@${VERSION}" --claude --local

echo
echo "Installed. Verify with:"
echo "  cat .claude/get-shit-done/VERSION"
echo "  gsd-sdk query state.load | head -5"
