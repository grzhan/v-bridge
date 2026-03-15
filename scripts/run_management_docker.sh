#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOY_DIR="${ROOT_DIR}/deploy/management"
ENV_FILE="${DEPLOY_DIR}/.env"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.yml"

BACKEND_PORT="${BACKEND_PORT:-}"
FRONTEND_PORT="${FRONTEND_PORT:-}"
GUAC_BASE_URL="${GUAC_BASE_URL:-}"

usage() {
  cat <<'USAGE'
Usage: ./scripts/run_management_docker.sh [options]

Options:
  --backend-port PORT   Published backend port (default from .env, fallback 8000)
  --frontend-port PORT  Published frontend port (default from .env, fallback 5173)
  --guac-base-url URL   Guacamole public base URL for backend
  --rebuild             Force build before startup
  -h, --help            Show help

Env alternatives:
  BACKEND_PORT, FRONTEND_PORT, GUAC_BASE_URL
USAGE
}

REBUILD=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --backend-port)
      BACKEND_PORT="${2:?missing value for --backend-port}"
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="${2:?missing value for --frontend-port}"
      shift 2
      ;;
    --guac-base-url)
      GUAC_BASE_URL="${2:?missing value for --guac-base-url}"
      shift 2
      ;;
    --rebuild)
      REBUILD=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      usage
      exit 1
      ;;
  esac
done

if [ ! -f "${ENV_FILE}" ]; then
  cp "${DEPLOY_DIR}/.env.example" "${ENV_FILE}"
  echo "Created ${ENV_FILE} from template."
fi

if [ -n "${BACKEND_PORT}" ]; then
  export BACKEND_PORT
fi
if [ -n "${FRONTEND_PORT}" ]; then
  export FRONTEND_PORT
fi
if [ -n "${GUAC_BASE_URL}" ]; then
  export GUAC_BASE_URL
fi

cd "${ROOT_DIR}"
if [ "${REBUILD}" -eq 1 ]; then
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d --build
else
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" up -d
fi

echo "Management system is starting..."
echo "Frontend: http://localhost:${FRONTEND_PORT:-5173}"
echo "Backend : http://localhost:${BACKEND_PORT:-8000}"
