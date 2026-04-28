#!/usr/bin/env bash
# Phase 24.1 Wave 0 — env-file key parity check.
# See .planning/phases/24.1-.../24.1-VALIDATION.md § HARD-07.
#
# Extended: direct `.env ⇄ .env.example` parity check. Previously native env
# was only covered transitively (.env ⇄ .env.docker ⇄ .env.docker.example,
# plus schemas ⇄ .env.example). The direct pair closes the gap where a
# developer could edit `.env` or `.env.example` in isolation without CI
# catching the drift against each other.
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
compare .env .env.example

# =============================================================================
# Schema-driven parity (added Phase 999.1.9 W10 per D-19)
# =============================================================================
#
# ASSUMPTION A6 (from Phase 999.1.9 RESEARCH.md §Claims-Assumptions, line 848):
# -----------------------------------------------------------------------------
# This regex (^\s*[A-Z][A-Z0-9_]*:\s*z\.) assumes env keys are declared as
# top-level object entries in Zod schemas using the pattern:
#
#     export const XxxSchema = z.object({
#       KEY_NAME: z.string(),          <- matched by regex
#       ANOTHER_KEY: z.coerce.number(), <- matched
#     });
#
# or inside a static `as const` topology shape:
#
#     export const XxxTopologyShape = {
#       KEY_NAME: z.coerce.number().positive(),  <- matched by regex
#     } as const;
#
# -----------------------------------------------------------------------------
# KNOWN LIMITATIONS (if schemas evolve beyond current conventions):
# 1. Keys defined via nested `.merge()`, `.extend()`, or spread-from-helper   -> MISSED
# 2. Keys defined via `z.record(z.enum([...]), z.string())`                   -> MISSED
# 3. Keys defined via dynamic construction (for-loop, Object.fromEntries)     -> MISSED
# 4. Keys where the left side isn't a plain identifier (e.g. `[DYN_KEY]:`)    -> MISSED
#
# CURRENT STATE (Phase 999.1.9 W10): all 8 infra/*.schema.ts + 6 apps/*/env.schema.ts
# (+ their `topology.schema.ts` + per-svc `external-apis.schema.ts`) use the plain
# `KEY: z.xxx(...)` pattern. Works reliably.
#
# IF ADDING A SCHEMA WITH NON-STANDARD KEY DECLARATION:
# -> Either refactor the schema to use the plain-pattern (preferred), or
# -> Extend this script to handle the new pattern (e.g., dual-pass grep,
#    Node-runtime reflection via `Object.keys(XxxSchema.shape)`).
# See: .planning/phases/999.1.9-config-layering-refactor-services-first-structure/999.1.9-RESEARCH.md
#      §Assumption A6 + §Example 5.
# -----------------------------------------------------------------------------
#
# ORCHESTRATOR-ONLY KEYS:
# -----------------------------------------------------------------------------
# The following env keys live in .env*/env.*.example files but are consumed
# by docker-compose itself (orchestrator layer), NOT by any application. They
# therefore never appear in a Zod app-schema and must be excluded from the
# schema-vs-env comparison. Adding them to a schema would violate the
# services-first layering (D-03: each service parses only its own keys).
#
# Provenance (infra/docker-compose.infra.yml):
#   POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB -> postgres container init
#   GARAGE_ADMIN_TOKEN                              -> garage + garage-webui sidecars
#
# When adding another orchestrator-only var (e.g., for a new infra container),
# append its key here and document its docker-compose consumption site above.
# -----------------------------------------------------------------------------
ORCHESTRATOR_ONLY_KEYS=$(printf '%s\n' \
  POSTGRES_USER \
  POSTGRES_PASSWORD \
  POSTGRES_DB \
  GARAGE_ADMIN_TOKEN \
  | sort -u)

# Extract all UPPER_SNAKE_CASE env keys declared in Zod-schemas under
# packages/config/src/apps/ + infra/. Grep regex: line starts with optional
# whitespace, UPPER_CASE identifier, colon, z. (marker of Zod schema entry).
expected_keys_from_schemas() {
  grep -rhoE '^\s*[A-Z][A-Z0-9_]*:\s*z\.' \
    packages/config/src/apps/ \
    packages/config/src/infra/ \
    | sed 's/:.*//' | tr -d ' ' | sort -u
}

# Strip orchestrator-only keys from an env-file's key list so the comparison
# only considers keys that apps are expected to consume.
app_keys_of() {
  comm -23 <(keys_of "$1") <(printf '%s\n' "$ORCHESTRATOR_ONLY_KEYS")
}

compare_schemas_vs_env() {
  local env_file="$1"
  local label="$2"
  if [ ! -f "$env_file" ]; then
    warn "$env_file missing — skipping schema parity check"
    return 0
  fi
  if diff <(expected_keys_from_schemas) <(app_keys_of "$env_file") > /dev/null; then
    pass "$label: matches schemas"
    return 0
  fi
  fail "$label: schema drift"
  echo "    --- Keys in schemas not in $env_file ---"
  comm -23 <(expected_keys_from_schemas) <(app_keys_of "$env_file") | sed 's/^/      /'
  echo "    --- Keys in $env_file not in schemas (excluding orchestrator-only) ---"
  comm -13 <(expected_keys_from_schemas) <(app_keys_of "$env_file") | sed 's/^/      /'
  return 1
}

compare_schemas_vs_env .env.example "env.example vs schemas"
compare_schemas_vs_env .env.docker.example "env.docker.example vs schemas"

exit $ERRORS
