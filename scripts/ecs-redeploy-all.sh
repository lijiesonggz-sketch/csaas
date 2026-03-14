#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="${1:-/opt/csaas}"
BRANCH="${2:-main}"
WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-180}"

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

if [[ ! -f "$PROJECT_DIR/.env" ]]; then
  echo "Missing $PROJECT_DIR/.env. Copy .env.example to .env before deploying." >&2
  exit 1
fi

wait_for_health() {
  local service_name="$1"
  local container_id
  container_id="$(sudo "${DC_CMD[@]}" ps -q "$service_name")"

  if [[ -z "$container_id" ]]; then
    echo "Container ID not found for service: $service_name" >&2
    return 1
  fi

  local has_healthcheck
  has_healthcheck="$(docker inspect --format '{{if .State.Health}}yes{{else}}no{{end}}' "$container_id" 2>/dev/null || echo no)"

  if [[ "$has_healthcheck" != "yes" ]]; then
    echo "Service $service_name has no healthcheck; skipping wait."
    return 0
  fi

  echo "Waiting for $service_name healthcheck (timeout: ${WAIT_TIMEOUT_SECONDS}s)"

  local start_ts now status
  start_ts="$(date +%s)"

  while true; do
    status="$(docker inspect --format '{{.State.Health.Status}}' "$container_id" 2>/dev/null || echo unknown)"

    if [[ "$status" == "healthy" ]]; then
      echo "$service_name is healthy."
      return 0
    fi

    if [[ "$status" == "unhealthy" ]]; then
      echo "$service_name became unhealthy." >&2
      return 1
    fi

    now="$(date +%s)"
    if (( now - start_ts >= WAIT_TIMEOUT_SECONDS )); then
      echo "Timed out waiting for $service_name to become healthy." >&2
      return 1
    fi

    sleep 3
  done
}

echo "[1/10] cd $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/10] git pull --ff-only origin $BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[3/10] build backend and frontend images"
sudo "${DC_CMD[@]}" build backend frontend

echo "[4/10] recreate backend container"
sudo "${DC_CMD[@]}" up -d --no-deps --force-recreate backend

echo "[5/10] wait for backend health"
wait_for_health backend

echo "[6/10] run backend migrations"
sudo "${DC_CMD[@]}" exec -T backend npm run typeorm -- migration:run -d dist/src/config/typeorm.config.js

echo "[7/10] recreate frontend container"
sudo "${DC_CMD[@]}" up -d --no-deps --force-recreate frontend

echo "[8/10] wait for frontend health"
wait_for_health frontend

echo "[9/10] recreate nginx container and wait for health"
sudo "${DC_CMD[@]}" up -d --no-deps --force-recreate nginx
wait_for_health nginx

echo "[10/10] show service status"
sudo "${DC_CMD[@]}" ps

echo
echo "Run ./scripts/ecs-check-services.sh $PROJECT_DIR for end-to-end checks."
