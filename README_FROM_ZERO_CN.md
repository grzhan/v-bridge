# Remote Gateway 从 0 启动指南（Docker 全栈）

本文档用于在一台新机器上，从 0 拉起本项目的管理系统（前端+后端+MySQL）和网关（Guacamole）。

## 1. 前置条件

- Linux 服务器一台（示例路径：`/home/moessr/remote_gateway`）
- 已安装 Docker 和 Docker Compose 插件（`docker compose version` 可用）
- 对外放通端口：
  - `5173`（管理前端）
  - `8000`（管理后端）
  - `8081`（Guacamole 网关）

## 2. 拉代码并进入目录

```bash
cd /home/moessr
git clone <your_repo_url> remote_gateway
cd /home/moessr/remote_gateway
```

## 3. 初始化管理系统配置

```bash
cp deploy/management/.env.example deploy/management/.env
```

编辑 `deploy/management/.env`，至少修改这些关键项：

```env
# 对外端口
BACKEND_PORT=8000
FRONTEND_PORT=5173

# MySQL（必须非空）
MYSQL_ROOT_PASSWORD=your_root_password
MYSQL_DATABASE=app_db
MYSQL_USER=app
MYSQL_PASSWORD=your_app_password

# 后端
APP_ENV=production
SECRET_KEY=change-this-in-production

# Guacamole
GUAC_ENABLED=true
GUAC_BASE_URL=http://<服务器公网IP或可访问域名>:8081
GUAC_USERNAME=guacadmin
GUAC_PASSWORD=<你在Guacamole实际使用的管理员密码>
GUAC_DATA_SOURCE=postgresql
```

## 4. 启动全栈

推荐一条命令：

```bash
./scripts/run_full_stack_docker.sh --rebuild
```

也可以分开启动：

```bash
./scripts/run_management_docker.sh --rebuild
./scripts/run_gateway_docker.sh
```

## 5. 启动后验证

### 5.1 查看容器状态

```bash
docker compose --env-file deploy/management/.env -f deploy/management/docker-compose.yml ps
docker compose -f deploy/guacamole/docker-compose.yml ps
```

### 5.2 健康检查

```bash
curl -s http://127.0.0.1:8000/health
```

应返回 `status=ok`。

### 5.3 验证 Guacamole 管理员账号密码是否正确

```bash
curl -sS -X POST 'http://127.0.0.1:8081/api/tokens' \
  -d 'username=guacadmin&password=<你的Guac密码>'
```

返回包含 `authToken` 说明密码正确。

## 6. 访问地址

- 管理前端：`http://<服务器IP>:5173`
- 管理后端：`http://<服务器IP>:8000`
- 网关页面：`http://<服务器IP>:8081`

默认种子管理员账号（管理系统）：

- 用户名：`admin`
- 密码：`admin123`

## 7. 关键配置说明（非常重要）

### 7.1 `GUAC_BASE_URL` 的取值

当前实现里，`GUAC_BASE_URL` 同时用于：

1. 后端调用 Guacamole API
2. 生成并返回给浏览器的“进入会话 URL”

因此它必须满足两件事：

- 后端容器可访问
- 用户浏览器可访问

如果你填 `http://host.docker.internal:8081`，容器通常可访问，但外部浏览器往往不能解析，用户点击“进入”会跳错地址。公网部署建议填公网 IP 或域名。

### 7.2 MySQL 初始化方式

管理系统 Docker 使用 `deploy/management/.env` 里的 `MYSQL_*` 在首次初始化时建库建账号。

- `MYSQL_ROOT_PASSWORD` 不能为空，否则 MySQL 容器会反复重启。
- `scripts/init_mysql.sql` 主要是本地开发初始化脚本，不是管理系统 Docker 启动必需步骤。

### 7.3 502 购买失败的常见原因

购买流程会在后端调用 Guacamole 创建/授权连接。若 `GUAC_USERNAME/GUAC_PASSWORD/GUAC_BASE_URL` 任一错误，前端会看到 `502`。

优先检查：

1. `deploy/management/.env` 中 Guacamole 配置
2. `curl /api/tokens` 是否能拿到 `authToken`
3. 管理后端日志

```bash
docker compose --env-file deploy/management/.env -f deploy/management/docker-compose.yml logs --tail=200 backend
```

## 8. 常用运维命令

### 8.1 停止

```bash
./scripts/stop_full_stack_docker.sh
```

### 8.2 重启管理后端（修改 `.env` 后常用）

```bash
docker compose --env-file deploy/management/.env -f deploy/management/docker-compose.yml up -d --force-recreate backend
```

### 8.3 清空并重建 Guacamole 数据（会清掉历史连接）

```bash
./scripts/stop_gateway_docker.sh
mv deploy/guacamole/data deploy/guacamole/data.bak.$(date +%F-%H%M%S)
mkdir -p deploy/guacamole/data
./scripts/run_gateway_docker.sh
```

## 9. 最小故障排查清单

1. `docker compose ... ps` 是否都为 `Up`
2. `127.0.0.1:8000/health` 是否正常
3. `127.0.0.1:8081/api/tokens` 是否能登录
4. 前端是否访问 `5173`
5. `.env` 修改后是否重建了 backend 容器
