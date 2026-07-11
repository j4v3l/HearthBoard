#!/usr/bin/env bash
set -euo pipefail

IMAGE_NAME="${IMAGE_NAME:-hearthboard:smoke-test}"
CONTAINER_NAME="${CONTAINER_NAME:-hearthboard-smoke-test}"
VOLUME_NAME="${VOLUME_NAME:-hearthboard-smoke-test-data}"
HOST_PORT="${HOST_PORT:-3000}"
BASE_URL="http://127.0.0.1:${HOST_PORT}"

cleanup() {
  docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  docker volume rm "${VOLUME_NAME}" >/dev/null 2>&1 || true
}

trap cleanup EXIT
cleanup

wait_for_endpoint() {
  local path="$1"
  local attempts="${2:-30}"
  local delay="${3:-2}"

  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS "${BASE_URL}${path}" >/dev/null; then
      return 0
    fi
    sleep "${delay}"
  done

  echo "Timed out waiting for ${BASE_URL}${path}" >&2
  docker logs "${CONTAINER_NAME}" >&2 || true
  return 1
}

echo "Building image ${IMAGE_NAME}"
docker build --build-arg INSTALL_PING="${INSTALL_PING:-false}" -t "${IMAGE_NAME}" .

echo "Starting container ${CONTAINER_NAME}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${HOST_PORT}:3000" \
  -e ALLOW_INSECURE_TLS=false \
  -v "${VOLUME_NAME}:/data" \
  "${IMAGE_NAME}" >/dev/null

echo "Waiting for readiness probe"
wait_for_endpoint "/api/ready"

echo "Creating test service"
SERVICE_ID="$(
  curl -fsS -X POST "${BASE_URL}/api/services" \
    -H "Content-Type: application/json" \
    -d '{"name":"Smoke Test","description":"docker smoke test","category":"Infrastructure","url":"","healthUrl":"","checkType":"None","icon":"Server","statusCheckEnabled":false}' \
    | sed -n 's/.*"id":"\([^"]*\)".*/\1/p'
)"

if [[ -z "${SERVICE_ID}" ]]; then
  echo "Failed to create test service" >&2
  exit 1
fi

echo "Restarting container to verify SQLite persistence"
docker restart "${CONTAINER_NAME}" >/dev/null
wait_for_endpoint "/api/ready"

echo "Verifying persisted service"
curl -fsS "${BASE_URL}/api/services/${SERVICE_ID}" | grep -q "Smoke Test"

echo "Cleaning up test service"
curl -fsS -X DELETE "${BASE_URL}/api/services/${SERVICE_ID}" >/dev/null

echo "Docker smoke test passed"
