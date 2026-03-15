#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${ROOT_DIR}/deploy/guacamole/docker-compose.yml"

cd "${ROOT_DIR}"
docker compose -f "${COMPOSE_FILE}" up -d

echo "Guacamole gateway is starting..."
echo "URL: http://localhost:8081/"
