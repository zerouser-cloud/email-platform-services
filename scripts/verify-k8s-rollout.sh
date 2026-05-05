#!/usr/bin/env bash
# scripts/verify-k8s-rollout.sh
# Phase 999.18.3 — L5 K8s rollout gate (FR-20).
# Invoked from .gitlab-ci.yml deploy stage AFTER `kubectl apply -k`.
# Exits 0 only if все Deployments полностью rolled out + readiness probe passes.

set -euo pipefail

NAMESPACE="${KUBE_NAMESPACE:-${1:-}}"
if [[ -z "$NAMESPACE" ]]; then
  echo "ERROR: namespace required — pass as first arg or export KUBE_NAMESPACE" >&2
  exit 1
fi

SERVICES=(gateway auth sender parser audience notifier)
ROLLOUT_TIMEOUT="${ROLLOUT_TIMEOUT:-300s}"

echo "=== K8s rollout gate (namespace=$NAMESPACE) ==="

for SVC in "${SERVICES[@]}"; do
  echo "--- $SVC ---"

  # Wait для full rollout (kubectl-native primitive)
  if ! kubectl rollout status deployment/$SVC -n "$NAMESPACE" --timeout="$ROLLOUT_TIMEOUT"; then
    echo "FAIL: $SVC rollout did not complete within $ROLLOUT_TIMEOUT" >&2
    kubectl describe deployment/$SVC -n "$NAMESPACE" >&2 || true
    kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=$SVC >&2 || true
    exit 1
  fi

  # Verify ≥1 ready pod (defense-in-depth — rollout status sometimes returns 0 without ready replicas)
  READY=$(kubectl get deployment/$SVC -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}')
  : "${READY:=0}"
  if [[ "$READY" -lt 1 ]]; then
    echo "FAIL: $SVC has 0 ready replicas after rollout" >&2
    exit 1
  fi
  echo "$SVC: $READY ready replicas"
done

echo "=== K8s rollout gate PASS ==="
