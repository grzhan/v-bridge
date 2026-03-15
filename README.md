# V-Bridge

![](./v-bridge.png)

Minimal implementation for browser-based VM access with authentication, authorization, and package-based billing.

For Chinese zero-to-deploy Docker instructions, see `README_FROM_ZERO_CN.md`.

## Stack

- Frontend: React + Vite + Tailwind + shadcn-style UI components
- Backend: FastAPI + SQLAlchemy + APScheduler
- Database: MySQL 8 (local service)
- Remote access gateway: Apache Guacamole (optional, local service)

## Docker Quick Start (Management + Gateway)

If you want to deploy quickly to another machine, use Docker scripts:

1. Management system (frontend + backend + mysql):

```bash
./scripts/run_management_docker.sh --rebuild
```

2. Gateway (Guacamole):

```bash
./scripts/run_gateway_docker.sh
```

Or start both together:

```bash
./scripts/run_full_stack_docker.sh --rebuild
```

Default URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- Guacamole: `http://localhost:8081`

Stop commands:

```bash
./scripts/stop_management_docker.sh
./scripts/stop_gateway_docker.sh
./scripts/stop_full_stack_docker.sh
```

Management Docker env file:

- Template: `deploy/management/.env.example`
- Runtime: copy to `deploy/management/.env` and edit values.

Important fields in `deploy/management/.env`:

- `GUAC_BASE_URL`: must be reachable by backend container and browser.
  - If gateway runs on same host with mapped `8081`: `http://host.docker.internal:8081`
  - If gateway uses domain: `https://guac.example.com`
- `GUAC_USERNAME` / `GUAC_PASSWORD` / `GUAC_DATA_SOURCE`
- `SECRET_KEY` (must change in production)
- `CORS_ORIGINS`

Custom ports example:

```bash
./scripts/run_management_docker.sh --backend-port 18000 --frontend-port 15173 --rebuild
```

## 1) Local Setup

### Prerequisites

- Conda
- Python 3.11 (managed by Conda)
- Node.js 20+
- MySQL 8 running on `127.0.0.1:3306` (native or Docker mapped port)

### Bootstrap

```bash
./scripts/setup_local.sh
```

This script will:

- Create Conda env `remote-gateway`
- Create MySQL DB/user from `scripts/init_mysql.sql`

If your MySQL is in Docker (for example container name `mysql8`), you can run:

```bash
./scripts/setup_mysql_docker.sh
```

`setup_local.sh` also supports modes:

```bash
MYSQL_MODE=local ./scripts/setup_local.sh
MYSQL_MODE=docker MYSQL_CONTAINER=mysql8 ./scripts/setup_local.sh
```

## 2) Run Backend

```bash
./scripts/run_backend.sh
```

Force reinstall backend dependencies only when needed:

```bash
INSTALL_DEPS=1 ./scripts/run_backend.sh
```

Specify custom backend port:

```bash
./scripts/run_backend.sh --port 18000
# or
BACKEND_PORT=18000 ./scripts/run_backend.sh
```

If you need to force CORS at startup:

```bash
./scripts/run_backend.sh \
  --port 8000 \
  --cors-origins "http://localhost:5173,http://127.0.0.1:5173" \
  --cors-regex "^https?://(localhost|127\\.0\\.0\\.1|192\\.168\\.[0-9]+\\.[0-9]+)(:[0-9]+)?$"
```

Backend endpoints:

- API: http://127.0.0.1:8000
- Docs: http://127.0.0.1:8000/docs

Default seeded admin account:

- username: `admin`
- password: `admin123`

## 3) Run Frontend

```bash
./scripts/run_frontend.sh
```

`run_frontend.sh` installs npm packages only if `frontend/node_modules` is missing.

Specify custom frontend port:

```bash
./scripts/run_frontend.sh --port 3001
# or
FRONTEND_PORT=3001 ./scripts/run_frontend.sh
```

If backend is not on `8000`, pass API base URL:

```bash
./scripts/run_frontend.sh --port 5173 --api-base-url http://127.0.0.1:8000
# or
FRONTEND_API_BASE_URL=http://127.0.0.1:8000 ./scripts/run_frontend.sh --port 5173
```

Or (recommended for multi-IP/LAN access), only pass backend API port.
Frontend will use current page host automatically:

```bash
./scripts/run_frontend.sh --port 5173 --api-port 8000
# or
FRONTEND_API_PORT=8000 ./scripts/run_frontend.sh --port 5173
```

## 4) One Command Start (Backend + Frontend)

Start both services with interactive port input (press Enter to use defaults `8000` and `5173`):

```bash
./scripts/run_all.sh
```

Start both with explicit ports:

```bash
./scripts/run_all.sh --backend-port 8000 --frontend-port 5173
```

By default, `run_all.sh` now starts frontend in dynamic-host mode:

- API host = browser current host (the host in URL you open)
- API port = backend port (for example `8000`)

This means you can open the same frontend from different IPs/hostnames without hardcoding one API IP.

`run_all.sh` now auto-resolves CORS origins for:

- `localhost` / `127.0.0.1`
- current machine LAN IPv4 addresses
- your selected frontend host + port

You can also pass env vars:

```bash
BACKEND_PORT=8000 FRONTEND_PORT=5173 ./scripts/run_all.sh --no-prompt
```

Only if you need to force a fixed backend address, set `--api-base-url` manually:

```bash
./scripts/run_all.sh \
  --backend-port 8000 \
  --frontend-port 5173 \
  --api-base-url http://172.30.184.55:8000 \
  --frontend-origin http://172.30.184.55:5173 \
  --no-prompt
```

Frontend:

- http://127.0.0.1:5173

## 5) LAN Access (局域网访问)

If you want phones/laptops in the same LAN to access this project, use your host LAN IP (not `127.0.0.1`).

Get current host LAN IP:

```bash
ip route get 1.1.1.1 | sed -n 's/.* src \([0-9.]*\).*/\1/p'
```

Example start command (replace `172.30.184.55` with your own host IP):

```bash
./scripts/run_all.sh \
  --backend-host 0.0.0.0 \
  --backend-port 8000 \
  --frontend-host 0.0.0.0 \
  --frontend-port 5173 \
  --no-prompt
```

This is enough for most cases. No fixed `--api-base-url` is required.

Access URLs:

- Local machine: `http://localhost:5173`
- Other LAN devices: `http://172.30.184.55:5173`

If LAN devices still cannot access:

- Ensure OS firewall allows `5173` and `8000`.
- Ensure router/AP client isolation is disabled.
- Ensure backend/frontend ports are not already occupied.

## 6) Public Deployment + Private VMs (公网部署 + 内网虚拟机)

This project supports public deployment while keeping VM instances private.

Architecture intent:

- Users access frontend/backend/guacamole via public domain.
- VM instances stay on private network IPs (for example `10.x`, `172.16-31.x`, `192.168.x`).
- Only Guacamole server needs network access to VM RDP ports.

Important notes:

- Do **not** expose VM `3389` to internet.
- In `resource_pool`, `host` should still be the VM private IP.
- `GUAC_BASE_URL` must be reachable by:
  - backend (server side API calls to Guacamole)
  - browser (returned launch URL opened in new tab)

Typical production env example:

```env
GUAC_ENABLED=true
GUAC_BASE_URL=https://guac.example.com
GUAC_USERNAME=guacadmin
GUAC_PASSWORD=change_this
GUAC_DATA_SOURCE=postgresql

CORS_ORIGINS=https://app.example.com
```

If Guacamole is behind reverse proxy path:

```env
GUAC_BASE_URL=https://gateway.example.com/guacamole
```

Network checklist:

1. Backend host can reach `GUAC_BASE_URL`.
2. Guacamole host can reach each VM private IP and RDP port.
3. VM firewall allows `3389/tcp` only from Guacamole host/VPC.
4. Public firewall only opens `80/443` for web entry.

Quick connectivity tests (from Guacamole host):

```bash
nc -vz <vm_private_ip> 3389
```

After changing `backend/.env`, restart backend service.

## Environment Config

Copy and edit backend env:

```bash
cp backend/.env.example backend/.env
```

`backend/.env` is the effective backend config file used at runtime.

Important fields:

- `APP_DATABASE_URL=mysql+pymysql://app:app@127.0.0.1:3306/app_db`
- `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`
- `CORS_ALLOW_ORIGIN_REGEX=...` (default now allows arbitrary `http(s)://host:port` origins)
- `GUAC_ENABLED=false` (set true after Guacamole is ready)
- `GUAC_BASE_URL=http://127.0.0.1:8081`

## Dynamic Resource Expansion (3 -> 6 machines)

No code changes required.

1. Prepare new VM (RDP reachable, credentials ready)
2. Admin page `Resources` -> add machine
3. Or Admin page `Import` -> batch import JSON
4. Health check machine and enable it
5. New orders automatically allocate from expanded idle pool

## Implemented Features

- JWT auth and role-based access
- User: dashboard, products, orders, wallet, profile
- Admin: overview, products, resources, import, orders, wallet, users, settings
- Package-based billing (buy fixed duration)
- Resource lifecycle: `IDLE -> BUSY -> IDLE`
- Scheduler for expiry reclamation
