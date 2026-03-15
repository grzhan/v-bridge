#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

DEFAULT_HOST="0.0.0.0"
DEFAULT_PORT="5173"
HOST="${FRONTEND_HOST:-$DEFAULT_HOST}"
PORT="${FRONTEND_PORT:-$DEFAULT_PORT}"
API_BASE_URL="${FRONTEND_API_BASE_URL:-}"
API_PORT="${FRONTEND_API_PORT:-}"
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
    --api-base-url)
      API_BASE_URL="${2:?missing value for --api-base-url}"
      shift 2
      ;;
    --api-port)
      API_PORT="${2:?missing value for --api-port}"
      shift 2
      ;;
    -h|--help)
      echo "Usage: $0 [--host HOST] [--port PORT] [--api-base-url URL] [--api-port PORT]"
      echo "Env: FRONTEND_HOST, FRONTEND_PORT, FRONTEND_API_BASE_URL, FRONTEND_API_PORT"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1"
      echo "Run '$0 --help' for usage."
      exit 1
      ;;
  esac
done

if [ "${PORT_FROM_ARG}" -eq 0 ] && [ -z "${FRONTEND_PORT:-}" ] && [ -t 0 ]; then
  read -r -p "Frontend port [${PORT}]: " input_port
  PORT="${input_port:-$PORT}"
fi

if ! [[ "${PORT}" =~ ^[0-9]+$ ]] || [ "${PORT}" -lt 1 ] || [ "${PORT}" -gt 65535 ]; then
  echo "Invalid frontend port: ${PORT}"
  exit 1
fi

cd frontend
if [ ! -d node_modules ]; then
  npm install
fi
if [ -n "${API_BASE_URL}" ]; then
  echo "Starting frontend on ${HOST}:${PORT} (API: ${API_BASE_URL})"
  VITE_API_BASE_URL="${API_BASE_URL}" npm run dev -- --host "${HOST}" --port "${PORT}"
elif [ -n "${API_PORT}" ]; then
  echo "Starting frontend on ${HOST}:${PORT} (API host: runtime host, API port: ${API_PORT})"
  VITE_API_PORT="${API_PORT}" npm run dev -- --host "${HOST}" --port "${PORT}"
else
  DEFAULT_API_PORT="8000"
  echo "Starting frontend on ${HOST}:${PORT} (API host: runtime host, API port: ${DEFAULT_API_PORT})"
  VITE_API_PORT="${DEFAULT_API_PORT}" npm run dev -- --host "${HOST}" --port "${PORT}"
fi
