#!/usr/bin/env bash
set -euo pipefail

MYSQL_MODE="${MYSQL_MODE:-auto}"           # auto | local | docker
MYSQL_CONTAINER="${MYSQL_CONTAINER:-mysql8}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_ROOT_USER="${MYSQL_ROOT_USER:-root}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-}"

if ! command -v conda >/dev/null 2>&1; then
  echo "conda is not installed."
  exit 1
fi

if conda env list | awk '{print $1}' | grep -qx 'remote-gateway'; then
  echo "Conda env remote-gateway already exists, skip create."
else
  conda env create -f environment.yml
fi

run_local_mysql() {
  if ! command -v mysql >/dev/null 2>&1; then
    return 1
  fi
  echo "Using local mysql client at ${MYSQL_HOST}:${MYSQL_PORT}"
  if [ -n "${MYSQL_ROOT_PASSWORD}" ]; then
    mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_ROOT_USER}" -p"${MYSQL_ROOT_PASSWORD}" < scripts/init_mysql.sql
  else
    mysql -h"${MYSQL_HOST}" -P"${MYSQL_PORT}" -u"${MYSQL_ROOT_USER}" -p < scripts/init_mysql.sql
  fi
}

run_docker_mysql() {
  if ! command -v docker >/dev/null 2>&1; then
    return 1
  fi
  if ! docker ps --format '{{.Names}}' | grep -qx "${MYSQL_CONTAINER}"; then
    return 1
  fi

  local password="${MYSQL_ROOT_PASSWORD}"
  if [ -z "${password}" ]; then
    password="$(docker inspect "${MYSQL_CONTAINER}" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MYSQL_ROOT_PASSWORD=//p' | head -n 1)"
  fi

  if [ -z "${password}" ]; then
    echo "Cannot determine MYSQL_ROOT_PASSWORD for container ${MYSQL_CONTAINER}. Set MYSQL_ROOT_PASSWORD and rerun."
    return 1
  fi

  echo "Using docker mysql container: ${MYSQL_CONTAINER}"
  docker exec -i "${MYSQL_CONTAINER}" mysql -u"${MYSQL_ROOT_USER}" -p"${password}" < scripts/init_mysql.sql
}

echo "Create MySQL database/user from scripts/init_mysql.sql"
case "${MYSQL_MODE}" in
  local)
    run_local_mysql || { echo "Local mysql init failed."; exit 1; }
    ;;
  docker)
    run_docker_mysql || { echo "Docker mysql init failed."; exit 1; }
    ;;
  auto)
    run_local_mysql || run_docker_mysql || {
      echo "No usable mysql target found. Install mysql client or run docker mysql container."
      exit 1
    }
    ;;
  *)
    echo "Invalid MYSQL_MODE=${MYSQL_MODE} (expected: auto|local|docker)"
    exit 1
    ;;
esac

echo "Setup complete."
