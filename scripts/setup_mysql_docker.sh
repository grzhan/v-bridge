#!/usr/bin/env bash
set -euo pipefail

MYSQL_MODE=docker "$(dirname "$0")/setup_local.sh"
