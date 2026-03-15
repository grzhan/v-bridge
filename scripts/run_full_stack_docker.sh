#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/run_management_docker.sh" "$@"
"${ROOT_DIR}/scripts/run_gateway_docker.sh"

echo "Full stack started."
echo "Frontend: http://localhost:${FRONTEND_PORT:-5173}"
echo "Backend : http://localhost:${BACKEND_PORT:-8000}"
echo "Gateway : http://localhost:8081/"
