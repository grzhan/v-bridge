#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"${ROOT_DIR}/scripts/stop_management_docker.sh"
"${ROOT_DIR}/scripts/stop_gateway_docker.sh"
