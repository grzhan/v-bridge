#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT="8000"
HOST="${BACKEND_HOST:-$DEFAULT_HOST}"
PORT="${BACKEND_PORT:-$DEFAULT_PORT}"
CORS="${CORS_ORIGINS:-}"
CORS_REGEX="${CORS_ALLOW_ORIGIN_REGEX:-}"
PORT_FROM_ARG=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --host)
      HOST="${2:?missing value for --host}"
      shift 2
      ;;
    --port)
      PORT="${2:?missing value for --port}"
      PORT_FROM_ARG=1
      shift 2
      ;;
    --cors-origins)
      CORS="${2:?missing value for --cors-origins}"
      shift 2
      ;;
    --cors-regex)
      CORS_REGEX="${2:?missing value for --cors-regex}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--host HOST] [--port PORT] [--cors-origins CSV] [--cors-regex REGEX]"
      echo "Env: BACKEND_HOST, BACKEND_PORT, CORS_ORIGINS, CORS_ALLOW_ORIGIN_REGEX, INSTALL_DEPS=1"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Run '$0 --help' for usage."
      exit 1
      ;;
  esac
done

if [ "${PORT_FROM_ARG}" -eq 0 ] && [ -z "${BACKEND_PORT:-}" ] && [ -t 0 ]; then
  read -r -p "Backend port [${PORT}]: " input_port
  PORT="${input_port:-$PORT}"
fi

if ! [[ "${PORT}" =~ ^[0-9]+$ ]] || [ "${PORT}" -lt 1 ] || [ "${PORT}" -gt 65535 ]; then
  echo "Invalid backend port: ${PORT}"
  exit 1
fi

source "$(conda info --base)/etc/profile.d/conda.sh"
conda activate remote-gateway

if [ "${INSTALL_DEPS:-0}" = "1" ]; then
  pip install -r backend/requirements.txt
fi

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
fi

EFFECTIVE_DB_URL="${APP_DATABASE_URL:-}"
if [ -z "${EFFECTIVE_DB_URL}" ] && [ -f backend/.env ]; then
  EFFECTIVE_DB_URL="$(sed -n 's/^APP_DATABASE_URL=//p' backend/.env | tail -n 1)"
fi
if [ -n "${EFFECTIVE_DB_URL}" ]; then
  SAFE_DB_URL="$(echo "${EFFECTIVE_DB_URL}" | sed -E 's#(://[^:/]+:)[^@]+@#\1***@#')"
  echo "Database URL: ${SAFE_DB_URL}"
fi

echo "Starting backend on ${HOST}:${PORT}"
if [ -n "${CORS}" ]; then
  export CORS_ORIGINS="${CORS}"
  echo "CORS origins: ${CORS_ORIGINS}"
fi
if [ -n "${CORS_REGEX}" ]; then
  export CORS_ALLOW_ORIGIN_REGEX="${CORS_REGEX}"
  echo "CORS regex: ${CORS_ALLOW_ORIGIN_REGEX}"
fi

# NOTE:
# Uvicorn WatchFilesReload always adds current working directory to watch set.
# Run from backend/ so reload does not scan project-level docker data dirs.
cd backend
uvicorn app.main:app --host "${HOST}" --port "${PORT}" --reload --reload-dir . --app-dir .
