#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

DEFAULT_BACKEND_HOST="0.0.0.0"
DEFAULT_BACKEND_PORT="8000"
DEFAULT_FRONTEND_HOST="0.0.0.0"
DEFAULT_FRONTEND_PORT="5173"

BACKEND_HOST_ENV_SET=0
BACKEND_PORT_ENV_SET=0
FRONTEND_HOST_ENV_SET=0
FRONTEND_PORT_ENV_SET=0
API_BASE_URL_ENV_SET=0
API_BASE_URL_ARG_SET=0

if [ -n "${BACKEND_HOST+x}" ]; then BACKEND_HOST_ENV_SET=1; fi
if [ -n "${BACKEND_PORT+x}" ]; then BACKEND_PORT_ENV_SET=1; fi
if [ -n "${FRONTEND_HOST+x}" ]; then FRONTEND_HOST_ENV_SET=1; fi
if [ -n "${FRONTEND_PORT+x}" ]; then FRONTEND_PORT_ENV_SET=1; fi
if [ -n "${API_BASE_URL+x}" ]; then API_BASE_URL_ENV_SET=1; fi

BACKEND_HOST="${BACKEND_HOST:-$DEFAULT_BACKEND_HOST}"
BACKEND_PORT="${BACKEND_PORT:-$DEFAULT_BACKEND_PORT}"
FRONTEND_HOST="${FRONTEND_HOST:-$DEFAULT_FRONTEND_HOST}"
FRONTEND_PORT="${FRONTEND_PORT:-$DEFAULT_FRONTEND_PORT}"
API_BASE_URL="${API_BASE_URL:-}"
FRONTEND_ORIGIN="${FRONTEND_ORIGIN:-}"

BACKEND_PID=""
PROMPT=1
BACKEND_PORT_FROM_ARG=0
FRONTEND_PORT_FROM_ARG=0

usage() {
  cat <<'USAGE'
Usage: ./scripts/run_all.sh [options]

Options:
  --backend-port PORT     Backend port (default: 8000)
  --frontend-port PORT    Frontend port (default: 5173)
  --backend-host HOST     Backend host bind (default: 0.0.0.0)
  --frontend-host HOST    Frontend host bind (default: 0.0.0.0)
  --api-base-url URL      Frontend API URL (default: auto from backend port)
  --frontend-origin URL   Browser origin for CORS allowlist (default: auto)
  --no-prompt             Disable interactive port prompt, use defaults/env/args
  -h, --help              Show help

Env override:
  BACKEND_HOST, BACKEND_PORT, FRONTEND_HOST, FRONTEND_PORT, API_BASE_URL, FRONTEND_ORIGIN, CORS_ORIGINS, CORS_ALLOW_ORIGIN_REGEX
USAGE
}

cleanup() {
  if [ -n "${BACKEND_PID}" ] && kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    kill "${BACKEND_PID}" >/dev/null 2>&1 || true
    wait "${BACKEND_PID}" >/dev/null 2>&1 || true
  fi
}

validate_port() {
  local value="$1"
  if ! [[ "${value}" =~ ^[0-9]+$ ]] || [ "${value}" -lt 1 ] || [ "${value}" -gt 65535 ]; then
    return 1
  fi
  return 0
}

resolve_primary_ipv4() {
  local ip4=""
  if command -v ip >/dev/null 2>&1; then
    ip4="$(ip route get 1.1.1.1 2>/dev/null | sed -n 's/.* src \([0-9.]*\).*/\1/p' | head -n 1)"
  fi
  if [ -z "${ip4}" ] && command -v hostname >/dev/null 2>&1; then
    ip4="$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' | head -n 1 || true)"
  fi
  echo "${ip4}"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --backend-port)
      BACKEND_PORT="${2:?missing value for --backend-port}"
      BACKEND_PORT_FROM_ARG=1
      shift 2
      ;;
    --frontend-port)
      FRONTEND_PORT="${2:?missing value for --frontend-port}"
      FRONTEND_PORT_FROM_ARG=1
      shift 2
      ;;
    --backend-host)
      BACKEND_HOST="${2:?missing value for --backend-host}"
      shift 2
      ;;
    --frontend-host)
      FRONTEND_HOST="${2:?missing value for --frontend-host}"
      shift 2
      ;;
    --api-base-url)
      API_BASE_URL="${2:?missing value for --api-base-url}"
      API_BASE_URL_ARG_SET=1
      shift 2
      ;;
    --frontend-origin)
      FRONTEND_ORIGIN="${2:?missing value for --frontend-origin}"
      shift 2
      ;;
    --no-prompt)
      PROMPT=0
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

if [ "${PROMPT}" -eq 1 ] && [ -t 0 ]; then
  if [ "${BACKEND_PORT_FROM_ARG}" -eq 0 ] && [ "${BACKEND_PORT_ENV_SET}" -eq 0 ]; then
    read -r -p "Backend port [${BACKEND_PORT}]: " input_backend_port
    BACKEND_PORT="${input_backend_port:-$BACKEND_PORT}"
  fi

  if [ "${FRONTEND_PORT_FROM_ARG}" -eq 0 ] && [ "${FRONTEND_PORT_ENV_SET}" -eq 0 ]; then
    read -r -p "Frontend port [${FRONTEND_PORT}]: " input_frontend_port
    FRONTEND_PORT="${input_frontend_port:-$FRONTEND_PORT}"
  fi
fi

if ! validate_port "${BACKEND_PORT}"; then
  echo "Invalid backend port: ${BACKEND_PORT}"
  exit 1
fi

if ! validate_port "${FRONTEND_PORT}"; then
  echo "Invalid frontend port: ${FRONTEND_PORT}"
  exit 1
fi

PRIMARY_IPV4="$(resolve_primary_ipv4)"

API_HOST_FOR_BROWSER="${BACKEND_HOST}"
if [ "${API_HOST_FOR_BROWSER}" = "0.0.0.0" ] || [ "${API_HOST_FOR_BROWSER}" = "::" ]; then
  if [ "${FRONTEND_HOST}" != "0.0.0.0" ] && [ "${FRONTEND_HOST}" != "::" ]; then
    API_HOST_FOR_BROWSER="${FRONTEND_HOST}"
  elif [ -n "${PRIMARY_IPV4}" ]; then
    API_HOST_FOR_BROWSER="${PRIMARY_IPV4}"
  else
    API_HOST_FOR_BROWSER="127.0.0.1"
  fi
fi
if [ -z "${API_BASE_URL}" ]; then
  API_BASE_URL="http://${API_HOST_FOR_BROWSER}:${BACKEND_PORT}"
fi

API_SCHEME="$(echo "${API_BASE_URL}" | sed -E 's#^(https?)://.*#\1#')"
API_HOST="$(echo "${API_BASE_URL}" | sed -E 's#^https?://([^/:]+).*#\1#')"

FRONTEND_HOST_FOR_BROWSER="${FRONTEND_HOST}"
if [ "${FRONTEND_HOST_FOR_BROWSER}" = "0.0.0.0" ] || [ "${FRONTEND_HOST_FOR_BROWSER}" = "::" ]; then
  if [ -n "${PRIMARY_IPV4}" ]; then
    FRONTEND_HOST_FOR_BROWSER="${PRIMARY_IPV4}"
  else
    FRONTEND_HOST_FOR_BROWSER="127.0.0.1"
  fi
fi

if [ -z "${FRONTEND_ORIGIN}" ]; then
  FRONTEND_ORIGIN="${API_SCHEME}://${FRONTEND_HOST_FOR_BROWSER}:${FRONTEND_PORT}"
fi

if [ -z "${CORS_ORIGINS:-}" ]; then
  CORS_ORIGINS="${FRONTEND_ORIGIN},http://localhost:${FRONTEND_PORT},http://127.0.0.1:${FRONTEND_PORT},${API_SCHEME}://${API_HOST}:${FRONTEND_PORT}"
  if [ "${FRONTEND_HOST}" != "0.0.0.0" ] && [ "${FRONTEND_HOST}" != "::" ]; then
    CORS_ORIGINS="${CORS_ORIGINS},${API_SCHEME}://${FRONTEND_HOST}:${FRONTEND_PORT}"
  fi
  if [ -n "${PRIMARY_IPV4}" ]; then
    CORS_ORIGINS="${CORS_ORIGINS},${API_SCHEME}://${PRIMARY_IPV4}:${FRONTEND_PORT}"
  fi
  CORS_ORIGINS="$(echo "${CORS_ORIGINS}" | tr ',' '\n' | sed 's#/$##' | awk 'NF && !seen[$0]++' | paste -sd ',' -)"
fi

if [ -z "${CORS_ALLOW_ORIGIN_REGEX:-}" ]; then
  CORS_ALLOW_ORIGIN_REGEX='^https?://([a-zA-Z0-9.-]+|\[[0-9a-fA-F:]+\])(:[0-9]+)?$'
fi

trap cleanup EXIT INT TERM

echo "Starting backend on ${BACKEND_HOST}:${BACKEND_PORT}"
echo "Resolved frontend origin: ${FRONTEND_ORIGIN}"
echo "Resolved API base URL: ${API_BASE_URL}"
echo "Resolved CORS origins: ${CORS_ORIGINS}"
CORS_ORIGINS="${CORS_ORIGINS}" CORS_ALLOW_ORIGIN_REGEX="${CORS_ALLOW_ORIGIN_REGEX}" \
  "${ROOT_DIR}/scripts/run_backend.sh" --host "${BACKEND_HOST}" --port "${BACKEND_PORT}" &
BACKEND_PID=$!

echo "Waiting backend health: ${API_BASE_URL}/health"
ready=0
for _ in $(seq 1 60); do
  if curl -fsS "${API_BASE_URL}/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "${BACKEND_PID}" >/dev/null 2>&1; then
    echo "Backend exited unexpectedly."
    exit 1
  fi
  sleep 1
done

if [ "${ready}" -ne 1 ]; then
  echo "Backend did not become healthy in time."
  exit 1
fi

echo "Starting frontend on ${FRONTEND_HOST}:${FRONTEND_PORT} (API: ${API_BASE_URL})"
if [ "${API_BASE_URL_ENV_SET}" -eq 1 ] || [ "${API_BASE_URL_ARG_SET}" -eq 1 ]; then
  FRONTEND_API_BASE_URL="${API_BASE_URL}" "${ROOT_DIR}/scripts/run_frontend.sh" \
    --host "${FRONTEND_HOST}" \
    --port "${FRONTEND_PORT}" \
    --api-base-url "${API_BASE_URL}"
else
  FRONTEND_API_PORT="${BACKEND_PORT}" "${ROOT_DIR}/scripts/run_frontend.sh" \
    --host "${FRONTEND_HOST}" \
    --port "${FRONTEND_PORT}" \
    --api-port "${BACKEND_PORT}"
fi
