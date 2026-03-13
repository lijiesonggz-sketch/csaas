#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="${1:-/opt/csaas}"
BRANCH="${2:-main}"
WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-120}"

if [[ ! -d "$PROJECT_DIR" ]]; then
  echo "Project directory does not exist: $PROJECT_DIR" >&2
  exit 1
fi

if command -v docker-compose >/dev/null 2>&1; then
  DC_CMD=(docker-compose)
elif docker compose version >/dev/null 2>&1; then
  DC_CMD=(docker compose)
else
  echo "Neither docker-compose nor docker compose is available." >&2
  exit 1
fi

wait_for_frontend_health() {
  local container_id
  container_id="$(sudo "${DC_CMD[@]}" ps -q frontend)"

  if [[ -z "$container_id" ]]; then
    echo "Frontend container ID not found." >&2
    return 1
  fi

  local has_healthcheck
  has_healthcheck="$(docker inspect --format '{{if .State.Health}}yes{{else}}no{{end}}' "$container_id" 2>/dev/null || echo no)"

  if [[ "$has_healthcheck" != "yes" ]]; then
    echo "Frontend healthcheck is not configured; skipping health wait."
    return 0
  fi

  echo "[5/7] waiting for frontend healthcheck (timeout: ${WAIT_TIMEOUT_SECONDS}s)"

  local start_ts now status
  start_ts="$(date +%s)"

  while true; do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo unknown)"

    if [[ "$status" == "healthy" ]]; then
      echo "Frontend is healthy."
      return 0
    fi

    if [[ "$status" == "unhealthy" ]]; then
      echo "Frontend became unhealthy." >&2
      return 1
    fi

    now="$(date +%s)"
    if (( now - start_ts >= WAIT_TIMEOUT_SECONDS )); then
      echo "Timed out waiting for frontend to become healthy." >&2
      return 1
    fi

    sleep 3
  done
}

echo "[1/7] cd $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/7] git pull --ff-only origin $BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[3/7] build frontend image"
sudo "${DC_CMD[@]}" build frontend

echo "[4/7] recreate frontend container"
sudo "${DC_CMD[@]}" up -d --no-deps --force-recreate frontend

wait_for_frontend_health

echo "[6/7] show frontend status"
sudo "${DC_CMD[@]}" ps frontend

echo "[7/7] tail frontend logs"
sudo "${DC_CMD[@]}" logs --tail=200 frontend

echo "Done."