#!/usr/bin/env bash

set -euo pipefail

PROJECT_DIR="${1:-/opt/csaas}"
BRANCH="${2:-main}"

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

echo "[1/6] cd $PROJECT_DIR"
cd "$PROJECT_DIR"

echo "[2/6] git pull --ff-only origin $BRANCH"
git pull --ff-only origin "$BRANCH"

echo "[3/6] build backend image"
sudo "${DC_CMD[@]}" build backend

echo "[4/6] recreate backend container"
sudo "${DC_CMD[@]}" up -d --no-deps --force-recreate backend

echo "[5/6] run backend migrations"
sudo "${DC_CMD[@]}" exec -T backend npm run typeorm -- migration:run -d dist/src/config/typeorm.config.js

echo "[6/6] tail backend logs"
sudo "${DC_CMD[@]}" logs --tail=200 backend

echo "Done."
