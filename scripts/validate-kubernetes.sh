#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

OVERLAY="${1:-default}"
OUTPUT_DIR="${TMPDIR:-/tmp}/hearthboard-kustomize-${OVERLAY}"

mkdir -p "${OUTPUT_DIR}"
kubectl kustomize "deploy/kubernetes/overlays/${OVERLAY}" > "${OUTPUT_DIR}/manifests.yaml"

if ! grep -q "kind: Deployment" "${OUTPUT_DIR}/manifests.yaml"; then
  echo "Rendered manifests are missing Deployment" >&2
  exit 1
fi

if command -v kubeconform >/dev/null 2>&1; then
  kubeconform -strict -summary "${OUTPUT_DIR}/manifests.yaml"
else
  echo "kubeconform not installed; validated Kustomize render only"
fi

echo "Validated Kubernetes overlay: ${OVERLAY}"
