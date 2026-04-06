#!/bin/sh
# Diun script notifier — deduplicates deploy calls and routes by environment.
#
# Called once per changed image. Uses flock to ensure exactly ONE Coolify
# deploy per environment per Diun watch cycle.
#
# Mount into Diun container:
#   /opt/email-platform/deploy-router.sh:/scripts/deploy-router.sh:ro
#
# Env vars set by Diun:
#   DIUN_ENTRY_STATUS  — "new", "update", "unchange", "skip"
#   DIUN_ENTRY_IMAGE   — full image ref, e.g. ghcr.io/.../gateway:dev-latest

[ "$DIUN_ENTRY_STATUS" = "update" ] || [ "$DIUN_ENTRY_STATUS" = "new" ] || exit 0

TAG="${DIUN_ENTRY_IMAGE##*:}"

case "$TAG" in
  dev-*) UUID="${COOLIFY_UUID_DEV}" ;;
  *)     UUID="${COOLIFY_UUID_PROD}" ;;
esac

[ -n "$UUID" ] || exit 1

LOCK="/tmp/diun-deploy-${UUID}.lock"

exec 9>"$LOCK"
flock -n 9 || exit 0

sleep 3
wget -q --header="Authorization: Bearer ${COOLIFY_TOKEN}" \
  -O /dev/null "http://${COOLIFY_HOST}/api/v1/deploy?uuid=${UUID}&force=false"
sleep 30
