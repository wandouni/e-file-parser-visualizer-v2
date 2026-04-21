# Rainbond 凭证配置指南

## 架构流程

```
Jenkins 构建镜像
     ↓
推送到 Docker Registry
     ↓
调用 Rainbond API
     ↓
Rainbond 拉取镜像并部署
```

需要配置的凭证：
1. **Rainbond API Token** — 用于部署应用
2. **Docker Registry 凭证** — 用于推送和拉取镜像

---

## Step 1：获取 Rainbond API Token

### 1.1 登录 Rainbond 控制台

访问你的 Rainbond 地址（例如：`http://rainbond.tsintergy.com`）

### 1.2 获取 API Token

**方式 A：通过 UI 获取（推荐）**

1. 右上角用户菜单 → **账户设置** 或 **API Token**
2. 点击 **生成新的 Token**
3. 复制 Token（仅显示一次，务必保存！）
4. Token 格式：`rbac_xxxxxxxxxxxxx`

**方式 B：通过命令行获取**

```bash
# 如果已安装 Rainbond CLI
rainbond auth login

# 获取 token
rainbond auth token
```

### 1.3 获取 API 端点

Rainbond API 地址格式：
```
http://rainbond-api.tsintergy.com:8080
# 或
http://your-rainbond-domain/api
```

---

## Step 2：在 Jenkins 中配置 Rainbond 凭证

### 2.1 添加 API Token 凭证

1. Jenkins → **Manage Jenkins** → **Manage Credentials**
2. 点击 **Jenkins** （全局域）
3. **Add Credentials**
4. 填写：
   ```
   Kind: Secret text
   Scope: Global
   Secret: <你的-rainbond-api-token>
   ID: rainbond-api-token
   Description: Rainbond API Token
   ```
5. **Create**

### 2.2 添加 Docker Registry 凭证（如果使用私有仓库）

1. **Add Credentials**
2. 填写：
   ```
   Kind: Username with password
   Scope: Global
   Username: your-docker-username
   Password: your-docker-password (或 token)
   ID: docker-registry-credentials
   Description: Docker Registry Credentials
   ```
3. **Create**

---

## Step 3：配置 Jenkinsfile 中的 Rainbond 部署

### 3.1 更新 Jenkinsfile 中的部署阶段

编辑 Jenkinsfile 中的"部署到 Rainbond"阶段：

```groovy
stage('部署到 Rainbond') {
    when {
        branch 'master'
    }
    steps {
        script {
            echo "部署到 Rainbond..."
            withCredentials([string(credentialsId: 'rainbond-api-token', variable: 'RAINBOND_TOKEN')]) {
                sh '''
                    set -e  # 错误立即退出
                    
                    # 配置变量
                    RAINBOND_URL="${RAINBOND_API_URL:-http://rainbond-api.tsintergy.com:8080}"
                    TEAM_NAME="${RAINBOND_TEAM:-tsintergy}"
                    APP_NAME="e-file-parser-visualizer"
                    
                    echo "Rainbond API URL: ${RAINBOND_URL}"
                    echo "Team: ${TEAM_NAME}"
                    echo "App: ${APP_NAME}"
                    
                    # 方式 1：创建或更新应用（推荐）
                    curl -X POST \
                      -H "Authorization: Bearer ${RAINBOND_TOKEN}" \
                      -H "Content-Type: application/json" \
                      -d "{
                        \"app_name\": \"${APP_NAME}\",
                        \"docker_image\": \"${FULL_IMAGE}\",
                        \"port\": 3000,
                        \"memory\": 512,
                        \"cpu\": 500,
                        \"env\": {
                          \"NODE_ENV\": \"production\"
                        },
                        \"volumes\": [
                          {
                            \"path\": \"/app/data\",
                            \"size\": 10
                          }
                        ]
                      }" \
                      ${RAINBOND_URL}/api/v1/teams/${TEAM_NAME}/apps \
                      -v || echo "警告：API 调用失败，可能已存在应用"
                    
                    echo "Rainbond 部署请求已发送"
                    sleep 10
                    
                    # 验证应用状态
                    echo "验证应用部署状态..."
                    curl -H "Authorization: Bearer ${RAINBOND_TOKEN}" \
                      ${RAINBOND_URL}/api/v1/teams/${TEAM_NAME}/apps/${APP_NAME} \
                      | jq '.data.status' || echo "无法获取应用状态"
                '''
            }
        }
    }
}
```

### 3.2 设置 Jenkins 环境变量

在 Jenkins 任务中设置以下环境变量：

**方式 A：通过 Jenkins UI**

1. 任务 → **Configure** → **Build Environment**
2. 勾选 **Use secret text(s) or files(s)**
3. 添加：
   ```
   Variable name: RAINBOND_API_URL
   Credentials: Secret text → rainbond-api-token
   ```
4. 或在环境变量部分添加：
   ```
   RAINBOND_API_URL=http://rainbond-api.tsintergy.com:8080
   RAINBOND_TEAM=tsintergy
   ```

**方式 B：在 Jenkinsfile 中设置**

```groovy
pipeline {
    agent any

    environment {
        RAINBOND_API_URL = "http://rainbond-api.tsintergy.com:8080"
        RAINBOND_TEAM = "tsintergy"
        DOCKER_REGISTRY = "docker.io"
        IMAGE_NAME = "e-file-parser-visualizer"
    }
    
    // ...
}
```

---

## Step 4：在 Rainbond 中配置应用

### 4.1 通过 Rainbond UI 手动创建应用（首次）

1. 登录 Rainbond UI
2. **应用** → **创建应用**
3. 选择 **Docker 镜像**
4. 填写：
   ```
   应用名：e-file-parser-visualizer
   镜像地址：docker.io/e-file-parser-visualizer:latest
   端口：3000
   内存：512 MB
   CPU：500 m
   ```
5. 创建应用

### 4.2 配置存储卷（数据持久化）

1. 应用 → **设置** → **存储**
2. **添加存储卷**：
   ```
   挂载点：/app/data
   大小：10 GB
   类型：本地存储
   ```
3. 保存

### 4.3 配置健康检查

1. 应用 → **设置** → **健康检查**
2. 填写：
   ```
   类型：HTTP
   路径：/
   端口：3000
   初始延迟：30s
   超时：10s
   间隔：30s
   最大重试：3
   ```
3. 保存

### 4.4 配置环境变量

1. 应用 → **设置** → **环境变量**
2. 添加：
   ```
   NODE_ENV=production
   ```

---

## Step 5：验证配置

### 5.1 测试 API 连接

```bash
# 使用你的实际 Token
RAINBOND_TOKEN="your-actual-token"
RAINBOND_URL="http://rainbond-api.tsintergy.com:8080"

# 测试 API 连接
curl -H "Authorization: Bearer ${RAINBOND_TOKEN}" \
  ${RAINBOND_URL}/api/v1/teams \
  | jq .

# 应该看到团队列表
```

### 5.2 测试应用部署

在 Jenkins 中运行一次构建：

1. Jenkins 任务 → **Build Now**
2. 观察构建日志，查找：
   ```
   [部署到 Rainbond] ...
   [验证应用状态] ...
   ```
3. 查看 Rainbond UI，确认应用已更新

---

## API 参考

### 创建/更新应用

```bash
POST /api/v1/teams/{team_name}/apps

{
  "app_name": "e-file-parser-visualizer",
  "docker_image": "docker.io/e-file-parser-visualizer:latest",
  "port": 3000,
  "memory": 512,      # MB
  "cpu": 500,         # millicores
  "env": {
    "NODE_ENV": "production"
  },
  "volumes": [
    {
      "path": "/app/data",
      "size": 10        # GB
    }
  ],
  "health_check": {
    "type": "http",
    "path": "/",
    "port": 3000,
    "initial_delay": 30,
    "timeout": 10,
    "interval": 30,
    "max_retries": 3
  }
}
```

### 获取应用信息

```bash
GET /api/v1/teams/{team_name}/apps/{app_name}
```

### 获取应用状态

```bash
GET /api/v1/teams/{team_name}/apps/{app_name}/status
```

### 重启应用

```bash
POST /api/v1/teams/{team_name}/apps/{app_name}/restart
```

---

## 常见问题

### Q1：如何找到我的 Rainbond Team Name？

登录 Rainbond UI，URL 中会显示 team name：
```
http://rainbond.com/t/{team_name}/overview
```

或通过 API：
```bash
curl -H "Authorization: Bearer ${TOKEN}" \
  http://rainbond-api:8080/api/v1/teams
```

### Q2：Docker 镜像在 Rainbond 中无法拉取

**检查**：
1. 镜像是否存在：
   ```bash
   docker pull docker.io/e-file-parser-visualizer:latest
   ```
2. Rainbond 是否配置了 Docker Registry 凭证
3. 网络连接是否正常

### Q3：应用部署后无法访问

**排查**：
1. 检查应用状态：
   ```bash
   curl -H "Authorization: Bearer ${TOKEN}" \
     http://rainbond-api:8080/api/v1/teams/{team}/apps/{app}/status
   ```
2. 查看应用日志：
   - Rainbond UI → 应用 → 日志
3. 检查端口映射是否正确

### Q4：如何回滚到之前的版本？

1. Rainbond UI → 应用 → 版本管理
2. 选择之前的版本 → 部署

---

## 安全建议

1. **保护 API Token**
   - 不要在代码中硬编码
   - 使用 Jenkins 凭证系统
   - 定期轮换 Token

2. **限制 API 访问范围**
   - 如果 Rainbond 支持，创建只有部署权限的 Token

3. **网络隔离**
   - 限制 Rainbond API 的访问范围
   - 使用防火墙规则

4. **监审日志**
   - 定期检查 Rainbond 部署日志
   - 监控应用变更

---

## 快速参考

| 配置项 | 值 |
|--------|-----|
| **Rainbond API URL** | `http://rainbond-api.tsintergy.com:8080` |
| **Jenkins 凭证 ID** | `rainbond-api-token` |
| **应用名** | `e-file-parser-visualizer` |
| **镜像地址** | `docker.io/e-file-parser-visualizer:latest` |
| **容器端口** | `3000` |
| **内存** | `512 MB` |
| **数据目录** | `/app/data` (10 GB) |

---

## 下一步

1. ✅ 获取 Rainbond API Token
2. ✅ 在 Jenkins 中添加凭证
3. ✅ 更新 Jenkinsfile 中的部署阶段
4. ✅ 在 Rainbond 中创建应用
5. ✅ 运行 Jenkins 构建进行测试
6. ✅ 验证应用在 Rainbond 中成功部署

有任何问题，查看 Rainbond 日志：
```bash
# 查看 Rainbond 容器日志
docker logs rainbond-api

# 或通过 Rainbond UI → 系统 → 日志
```
