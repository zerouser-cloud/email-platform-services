#!/usr/bin/env bash
# Phase 999.17.1 — centralized scanner image tags (RESEARCH §Anti-Patterns).
# Source from any verify-*.sh / secrets-*.sh: . "$(dirname "${BASH_SOURCE[0]}")/_versions.sh"
# These tags MUST be the ONLY hardcoded image tags in the project (W2 fix per checker).
# Bump in ONE place when scanners update.

# shellcheck disable=SC2034  # consumed by sourced scripts via `source`
readonly GITLEAKS_IMAGE="zricethezav/gitleaks:v8.30.1"
# shellcheck disable=SC2034
readonly SEMGREP_IMAGE="returntocorp/semgrep:1.50"
# shellcheck disable=SC2034
readonly TRIVY_IMAGE="aquasec/trivy:0.50.4"
