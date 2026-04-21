# 部署指南：Jenkins + Rainbond

## 架构概述

```
代码仓库 → Jenkins → Docker Registry → Rainbond → 生产环境
   ↓                                       ↓
  SCM                                  应用管理
```

## 前置条件

### 1. Docker Registry
- Docker Hub / 私有 Registry
- 需要获得推送权限

### 2. Jenkins 服务器
- 安装 Docker（用于构建镜像）
- 安装 Git（用于 SCM 拉取）
- 安装 curl（用于 API 调用）

### 3. Rainbond 集群
- 部署完整的 Rainbond 平台
- 配置 Docker Registry 访问权限
- 获取 API Token

## 配置步骤

### 第一步：Jenkins 凭证配置

在 Jenkins 管理界面添加以下凭证：

1. **Docker Registry 凭证** （`docker-registry-credentials`）
   ```
   用户名: your-docker-username
   密码: your-docker-password
   ```

2. **Rainbond API Token** （`rainbond-api-token`）
   ```
   Token: your-rainbond-api-token
   ```

### 第二步：创建 Jenkins Job

#### 方式 A：使用 Jenkinsfile（推荐）

1. 在 Jenkins 创建新的 **Pipeline** 任务
2. 配置 SCM：指向当前仓库
3. Pipeline 定义：选择 **Pipeline script from SCM**
4. SCM：Git
5. Repository URL：`https://github.com/your-org/e-file-parser-visualizer-v2.git`
6. Script Path：`Jenkinsfile`

#### 方式 B：使用 GitHub Actions（无需 Jenkins）

直接使用 `.github/workflows/deploy.yml`，无需 Jenkins。

### 第三步：Rainbond 应用部署

#### 方式 1：通过 Rainbond UI 部署

1. 登录 Rainbond 控制台
2. 创建新应用：
   - 应用名：`e-file-parser-visualizer`
   - 应用类型：Docker 镜像
   - 镜像地址：`docker.io/e-file-parser-visualizer:latest`
   - 端口：3000
   - 内存：512MB
   - CPU：1 核

3. 配置存储卷（用于数据库持久化）
   - 挂载点：`/app/data`
   - 存储大小：10GB

4. 配置健康检查
   - 类型：HTTP
   - 路径：`/`
   - 端口：3000
   - 初始延迟：30s

5. 部署应用

#### 方式 2：通过 Rainbond CLI 部署

```bash
# 安装 Rainbond CLI
curl -L https://pkg.rainbond.com/install | bash

# 登录
rainbond login

# 部署应用
rainbond app create \
  --name e-file-parser-visualizer \
  --team default \
  --image docker.io/e-file-parser-visualizer:latest \
  --port 3000 \
  --memory 512
```

#### 方式 3：使用 Rainbond Compose 部署

```bash
cd e-file-parser-visualizer-v2
rainbond compose up -f rainbond-compose.yaml
```

## CI/CD 工作流程

### 完整流程

```
1. 开发者提交代码到 master 分支
   ↓
2. Jenkins 自动触发构建
   ├── 检出代码
   ├── 类型检查
   ├── 构建 Docker 镜像
   ├── 推送镜像到 Registry
   └── 触发 Rainbond 部署
   ↓
3. Rainbond 接收部署请求
   ├── 拉取新镜像
   ├── 停止旧容器
   ├── 启动新容器
   └── 执行健康检查
   ↓
4. 应用上线
```

### 环境变量配置

在 Jenkins 中配置以下环境变量：

```bash
# Docker Registry
DOCKER_REGISTRY=docker.io
IMAGE_NAME=your-org/e-file-parser-visualizer

# Rainbond
RAINBOND_API_URL=http://rainbond-api:8080
RAINBOND_TEAM=default
RAINBOND_APP_URL=http://app.rainbond.local:3000
```

## 本地测试

### 使用 Docker Compose

```bash
# 构建镜像
docker-compose build

# 启动应用
docker-compose up -d

# 查看日志
docker-compose logs -f app

# 测试应用
curl http://localhost:3000

# 停止应用
docker-compose down
```

### 手动构建和运行

```bash
# 构建镜像
docker build -t e-file-parser-visualizer:latest .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  --name e-file-parser \
  e-file-parser-visualizer:latest

# 查看日志
docker logs -f e-file-parser

# 清理
docker stop e-file-parser
docker rm e-file-parser
```

## 数据库迁移

SQLite 数据库文件位于 `/app/data/app.db`

### 备份数据

```bash
# 从容器复制数据
docker cp e-file-parser:/app/data/app.db ./backup/app.db

# 或在 Rainbond UI 中通过存储卷导出
```

### 恢复数据

```bash
# 复制文件到容器
docker cp ./backup/app.db e-file-parser:/app/data/

# 重启应用
docker restart e-file-parser
```

## 监控和日志

### Jenkins 日志

在 Jenkins 控制台查看构建输出

### Docker 日志

```bash
# 查看容器日志
docker logs -f container-name

# 查看详细日志
docker logs --timestamps container-name

# 查看最近 100 行日志
docker logs --tail 100 container-name
```

### Rainbond 日志

1. 登录 Rainbond UI
2. 进入应用 → 日志
3. 实时查看应用日志

## 故障排除

### 镜像拉取失败

```bash
# 检查 Docker Registry 凭证
docker login

# 手动拉取镜像
docker pull docker.io/e-file-parser-visualizer:latest
```

### 应用启动失败

```bash
# 查看容器日志
docker logs container-name

# 检查端口占用
lsof -i :3000

# 检查磁盘空间
df -h
```

### 数据库锁定

```bash
# SQLite 数据库被锁定时，通常由并发写入导致
# 解决方案：
# 1. 重启应用
# 2. 检查应用日志找出导致锁定的操作
# 3. 考虑增加数据库超时时间
```

## 回滚策略

### 快速回滚（使用先前镜像）

```bash
# 在 Rainbond UI 中
# 应用 → 版本管理 → 选择之前的版本 → 重新部署
```

### 手动回滚

```bash
# 在 Jenkins 中重新运行之前的构建
# 或手动推送旧镜像标签
docker tag old-image:hash docker.io/e-file-parser-visualizer:latest
docker push docker.io/e-file-parser-visualizer:latest
```

## 性能优化

### Docker 镜像优化

- 使用多阶段构建（已在 Dockerfile 中实现）
- 减小镜像大小（当前约 200MB）
- 使用镜像缓存

### 应用运行优化

```bash
# 在 Rainbond 中调整资源
内存：1GB（生产环境）
CPU：2 核（生产环境）
```

### Node.js 优化

```javascript
// 启用生产模式
NODE_ENV=production

// 考虑使用 PM2 或类似的进程管理器
// 但 Next.js 已内置进程管理
```

## 安全建议

1. **镜像扫描**：在推送前扫描漏洞
   ```bash
   docker scan docker.io/e-file-parser-visualizer:latest
   ```

2. **密钥管理**：使用 Rainbond secrets
   - 不要在镜像中硬编码密钥
   - 使用环境变量从 Rainbond 注入

3. **网络安全**
   - 配置 SSL/TLS（在 Rainbond 网关）
   - 限制 API 访问范围

4. **定期更新**
   ```bash
   # 定期更新依赖
   npm update
   docker build -t e-file-parser-visualizer:latest .
   ```

## 常用命令速查

```bash
# 查看 Rainbond 应用状态
rainbond app status e-file-parser-visualizer

# 查看应用日志
rainbond app logs e-file-parser-visualizer

# 扩容应用
rainbond app scale e-file-parser-visualizer --replicas 3

# 删除应用
rainbond app delete e-file-parser-visualizer
```

## 相关资源

- [Rainbond 官方文档](https://www.rainbond.com/docs/)
- [Jenkins 流水线文档](https://www.jenkins.io/doc/book/pipeline/)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)
- [Docker 最佳实践](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
