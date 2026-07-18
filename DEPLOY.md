# Mod-eMotor 服务器部署 SOP

## 环境要求

| 项目 | 要求 |
|---|---|
| 操作系统 | Linux x86_64 |
| Docker | >= 20.10 |
| Docker Compose | >= 2.0 |
| 对外端口 | **3013** |
| 网络 | 能访问 `rdm-harbor.segway-ninebot.com` |

---

## 一、服务器初始化（仅首次）

### 1.1 安装 Docker

```bash
# Rocky Linux / CentOS
sudo dnf config-manager --add-repo https://download.docker.com/linux/rhel/docker-ce.repo
sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl enable --now docker

# 验证
docker --version
docker compose version
```

### 1.2 登录 Harbor

```bash
docker login rdm-harbor.segway-ninebot.com
# 输入账号密码（与本地一致）
```

### 1.3 创建部署目录

```bash
mkdir -p /opt/mod-emotor && cd /opt/mod-emotor
```

将 `docker-compose.prod.yml` 上传到该目录。

---

## 二、部署/更新

### 2.1 拉取最新镜像

```bash
docker pull rdm-harbor.segway-ninebot.com/mod-emotor/frontend:latest
```

### 2.2 启动/更新服务

```bash
cd /opt/mod-emotor

# 首次启动
docker compose -f docker-compose.prod.yml up -d

# 更新重启（拉取新镜像后）
docker compose -f docker-compose.prod.yml up -d --force-recreate
```

### 2.3 清理旧镜像

```bash
docker image prune -f
```

---

## 三、日常运维

### 查看状态

```bash
docker compose -f docker-compose.prod.yml ps
```

### 查看日志

```bash
docker compose -f docker-compose.prod.yml logs -f        # 实时
docker compose -f docker-compose.prod.yml logs --tail=100 # 最近 100 行
```

### 重启

```bash
docker compose -f docker-compose.prod.yml restart
```

### 停止

```bash
docker compose -f docker-compose.prod.yml down
```

### 验证服务

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3013
# 返回 200 即正常
```

---

## 四、本地构建 & 推送（开发机执行）

```bash
cd /Users/fang.zhou/work/Mod-eMotor

# 确保有 buildx builder（只需一次）
docker buildx create --name multiarch --use --bootstrap 2>/dev/null || docker buildx use multiarch

# 构建 x86 镜像并推送
docker buildx build \
  --platform linux/amd64 \
  --tag rdm-harbor.segway-ninebot.com/mod-emotor/frontend:latest \
  --push \
  .
```

---

## 五、快速命令速查

```bash
# 部署
docker pull rdm-harbor.segway-ninebot.com/mod-emotor/frontend:latest && \
  docker compose -f /opt/mod-emotor/docker-compose.prod.yml up -d --force-recreate

# 看日志
docker logs -f mod-emotor

# 健康检查
curl -s -o /dev/null -w "%{http_code}" http://localhost:3013
```