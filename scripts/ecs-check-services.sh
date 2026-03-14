#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="${1:-/opt/csaas}"

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

check_container_health() {
  local container_name="$1"

  if ! docker inspect "$container_name" >/dev/null 2>&1; then
    echo "$container_name: not found"
    return 1
  fi

  local status
  status="$(docker inspect --format '{{.State.Status}}' "$container_name" 2>/dev/null || echo unknown)"

  local health
  health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_name" 2>/dev/null || echo unknown)"

  echo "$container_name: status=$status health=$health"

  if [[ "$status" != "running" ]]; then
    return 1
  fi

  if [[ "$health" != "none" && "$health" != "healthy" ]]; then
    return 1
  fi

  return 0
}

check_http() {
  local name="$1"
  local url="$2"

  if curl -fsS "$url" >/dev/null; then
    echo "$name: ok ($url)"
    return 0
  fi

  echo "$name: failed ($url)" >&2
  return 1
}

echo "[1/4] cd $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/4] docker compose status"
sudo "${DC_CMD[@]}" ps

echo "[3/4] container health"
overall_ok=0

check_container_health csaas-postgres || overall_ok=1
check_container_health csaas-redis || overall_ok=1
check_container_health csaas-backend || overall_ok=1
check_container_health csaas-frontend || overall_ok=1

echo "[4/4] http checks"
check_http backend "http://127.0.0.1:3000/health" || overall_ok=1
check_http frontend "http://127.0.0.1:3001/api/health" || overall_ok=1

if [[ "$overall_ok" -ne 0 ]]; then
  echo "One or more checks failed." >&2
  exit 1
fi

echo "All services are running and reachable."