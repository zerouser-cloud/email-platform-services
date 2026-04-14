#!/usr/bin/env bash
# Garage local bootstrap — idempotent via marker file /var/lib/garage/meta/.bootstrapped.
#
# Runs the 7 verified Garage CLI commands to:
#   1. Discover node ID
#   2. Assign storage layout (zone=local, capacity=1G)
#   3. Apply layout (version 1)
#   4. Import the static test key as "email-platform-local"
#   5. Create bucket "parser"
#   6. Create bucket "public"
#   7. Grant read+write+owner on both buckets to the key
#
# Usage: pnpm garage:bootstrap  (or bash infra/docker/garage-bootstrap.sh)
# Prereq: Garage container running (via pnpm infra:up or pnpm docker:up).

set -euo pipefail

# --- Load static credentials from .env.docker (single source of truth per D-11) ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../../.env.docker"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing env file: $ENV_FILE" >&2
  exit 1
fi
STORAGE_ACCESS_KEY="$(grep -E '^STORAGE_ACCESS_KEY=' "$ENV_FILE" | cut -d= -f2-)"
STORAGE_SECRET_KEY="$(grep -E '^STORAGE_SECRET_KEY=' "$ENV_FILE" | cut -d= -f2-)"
if [[ -z "${STORAGE_ACCESS_KEY:-}" || -z "${STORAGE_SECRET_KEY:-}" ]]; then
  echo "Missing STORAGE_ACCESS_KEY/STORAGE_SECRET_KEY in $ENV_FILE" >&2
  exit 1
fi

# --- Discover the running Garage container (try infra-only stack first, then isolated) ---
REPO_ROOT="${SCRIPT_DIR}/../.."
cd "$REPO_ROOT"
CONTAINER="$(docker compose -f infra/docker-compose.infra.yml -f infra/docker-compose.dev-ports.yml -f infra/docker-compose.webui-ports.yml ps -q garage 2>/dev/null || true)"
if [[ -z "${CONTAINER:-}" ]]; then
  CONTAINER="$(docker compose -f infra/docker-compose.yml -f infra/docker-compose.webui-ports.yml ps -q garage 2>/dev/null || true)"
fi
if [[ -z "${CONTAINER:-}" ]]; then
  echo "Garage container not running. Run 'pnpm infra:up' (native) or 'pnpm docker:up' (isolated) first." >&2
  exit 1
fi

# --- Idempotence: short-circuit if marker present ---
MARKER_PATH="/var/lib/garage/meta/.bootstrapped"
if docker exec "$CONTAINER" test -f "$MARKER_PATH" 2>/dev/null; then
  echo "Already bootstrapped (marker present at $MARKER_PATH), skipping."
  exit 0
fi

# --- Wait for Garage to be responsive (up to ~30s) ---
echo "Waiting for Garage to be ready..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
  if docker exec "$CONTAINER" /garage -c /etc/garage.toml status >/dev/null 2>&1; then
    echo "Garage is responsive."
    break
  fi
  if [[ "$i" == "15" ]]; then
    echo "Garage did not become responsive after 30s. Check container logs:" >&2
    echo "  docker logs $CONTAINER" >&2
    exit 1
  fi
  sleep 2
done

# --- Run the 7 verified CLI commands ---
echo "[1/7] Discovering node ID..."
NODE_ID="$(docker exec "$CONTAINER" /garage -c /etc/garage.toml node id -q | cut -d@ -f1)"
if [[ -z "${NODE_ID:-}" ]]; then
  echo "Failed to discover Garage node ID." >&2
  exit 1
fi
echo "      node id = $NODE_ID"

echo "[2/7] Assigning layout (zone=local, capacity=1G)..."
docker exec "$CONTAINER" /garage -c /etc/garage.toml layout assign -z local -c 1G "$NODE_ID"

echo "[3/7] Applying layout (version 1)..."
docker exec "$CONTAINER" /garage -c /etc/garage.toml layout apply --version 1

echo "[4/7] Importing key 'email-platform-local'..."
docker exec "$CONTAINER" /garage -c /etc/garage.toml key import --yes "$STORAGE_ACCESS_KEY" "$STORAGE_SECRET_KEY" -n email-platform-local

echo "[5/7] Creating bucket 'parser'..."
docker exec "$CONTAINER" /garage -c /etc/garage.toml bucket create parser

echo "[6/7] Creating bucket 'public'..."
docker exec "$CONTAINER" /garage -c /etc/garage.toml bucket create public

echo "[7/7] Granting read+write+owner on both buckets..."
docker exec "$CONTAINER" /garage -c /etc/garage.toml bucket allow --key email-platform-local --read --write --owner parser
docker exec "$CONTAINER" /garage -c /etc/garage.toml bucket allow --key email-platform-local --read --write --owner public

# --- Write idempotence marker ---
docker exec "$CONTAINER" touch "$MARKER_PATH"

echo ""
echo "Garage bootstrap complete. Buckets: parser, public. Key: email-platform-local."
