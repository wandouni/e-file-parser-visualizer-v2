# Jenkins 配置指南 - Git 认证失败解决方案

## ❌ 问题分析

错误信息：
```
fatal: Authentication failed for 'http://git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2/'
```

**原因**：Jenkins 没有有效的 Git 凭证来访问你的私有仓库。

---

## ✅ 解决方案

### 方式 1：HTTP 用户名/密码认证（推荐用于自建 Git）

#### Step 1：在 Jenkins 中添加凭证

1. 打开 Jenkins 主页 → **Manage Jenkins** → **Manage Credentials**
2. 点击左侧 **Stores scoped to Jenkins**
3. 点击 **Jenkins** （全局域名）
4. 左侧 → **Add Credentials**
5. 填写信息：
   ```
   Kind: Username with password
   Scope: Global (Jenkins, nodes, items, all child items, etc)
   Username: shenjj (你的 Git 用户名)
   Password: your-git-password (你的 Git 密码或 token)
   ID: git-tsintergy-credentials (重要！记住这个 ID)
   Description: Tsintergy Git Repository Credentials
   ```
6. 点击 **Create**

#### Step 2：在 Pipeline 中配置凭证

编辑 `Jenkinsfile`，在 `checkout scm` 前添加凭证配置：

```groovy
pipeline {
    agent any

    environment {
        GIT_CREDENTIALS_ID = 'git-tsintergy-credentials'
    }

    stages {
        stage('检出代码') {
            steps {
                script {
                    echo "检出代码..."
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '*/master']],
                        userRemoteConfigs: [[
                            url: 'http://git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git',
                            credentialsId: "${GIT_CREDENTIALS_ID}"
                        ]]
                    ])
                }
            }
        }
        // ... 其他 stages
    }
}
```

#### Step 3：在任务配置中选择凭证

如果使用 Pipeline 任务的 UI 配置（非 Jenkinsfile）：

1. 打开任务 → **Configure**
2. 左侧 **Pipeline** 部分
3. **Definition** 选择 **Pipeline script from SCM**
4. **SCM** 选择 **Git**
5. 填写：
   - **Repository URL**: `http://git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git`
   - **Credentials**: 选择 `git-tsintergy-credentials`
   - **Branches to build**: `*/master`
   - **Script Path**: `Jenkinsfile`
6. 点击 **Save**

---

### 方式 2：SSH 密钥认证（更安全）

#### Step 1：在 Jenkins 所在服务器生成 SSH 密钥

```bash
# 以 Jenkins 用户运行
sudo su - jenkins

# 生成 SSH 密钥
ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""

# 查看公钥
cat ~/.ssh/id_rsa.pub
```

#### Step 2：在 Git 服务器添加公钥

1. 登录 Gitea/GitLab/Gitee 界面（`git.tsintergy.com:8070`）
2. 用户设置 → **SSH 密钥** 或 **Public Keys**
3. 添加公钥（粘贴上面的输出）
4. 保存

#### Step 3：在 Jenkins 中添加私钥凭证

1. Jenkins → **Manage Credentials** → **Jenkins**
2. **Add Credentials**
3. 填写：
   ```
   Kind: SSH Username with private key
   Scope: Global
   Username: shenjj
   Private Key: (选择 "Enter directly")
     复制 ~/.ssh/id_rsa 的全部内容
   ID: git-tsintergy-ssh
   Description: Tsintergy Git SSH Key
   ```
4. 点击 **Create**

#### Step 4：更新 Jenkinsfile

```groovy
stage('检出代码') {
    steps {
        script {
            checkout([
                $class: 'GitSCM',
                branches: [[name: '*/master']],
                userRemoteConfigs: [[
                    url: 'ssh://git@git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git',
                    credentialsId: 'git-tsintergy-ssh'
                ]]
            ])
        }
    }
}
```

---

### 方式 3：Git Token（现代方式）

如果你的 Git 服务支持 Token：

#### Step 1：在 Git 服务生成 Token

登录 `git.tsintergy.com:8070` → 用户设置 → 生成 Token

#### Step 2：在 Jenkins 添加凭证

```
Kind: Username with password
Username: your-username
Password: generated-token-here
ID: git-tsintergy-token
```

---

## 🔍 验证配置

### 测试 1：Jenkins 服务器可达性

在 Jenkins 服务器运行：
```bash
# 测试网络连接
curl -v http://git.tsintergy.com:8070

# 测试 Git 连接
git clone http://git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git
```

### 测试 2：Jenkins 凭证是否生效

在 Pipeline 中添加调试步骤：
```groovy
stage('测试凭证') {
    steps {
        script {
            sh '''
                # 显示 Git 配置
                git config --list | grep credential || echo "No credential config"
                
                # 测试连接
                timeout 10 git ls-remote http://git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git HEAD || echo "Connection failed"
            '''
        }
    }
}
```

### 测试 3：完整的 Pipeline 运行

1. 在 Jenkins 中点击 **Build Now**
2. 查看控制台输出：
   ```
   ✅ 成功：[检出代码] ...
   ✅ 成功：[代码质量检查] ...
   ```

---

## 🚨 常见问题排查

### 问题 1：仍然提示认证失败

**检查清单**：
- [ ] Git 凭证 ID 是否正确（Jenkinsfile 中的 `credentialsId`）
- [ ] 用户名和密码是否正确
- [ ] 权限：用户是否有权限访问该仓库
- [ ] 网络：Jenkins 是否能访问 Git 服务器
  ```bash
  telnet git.tsintergy.com 8070
  ```

### 问题 2：SSH 密钥认证失败

**检查**：
```bash
# 确认 SSH 配置
sudo cat /var/lib/jenkins/.ssh/id_rsa
sudo cat /var/lib/jenkins/.ssh/id_rsa.pub

# 测试 SSH 连接
ssh -i /var/lib/jenkins/.ssh/id_rsa git@git.tsintergy.com
```

### 问题 3：防火墙/代理问题

如果 Jenkins 服务器在代理后面：

```groovy
stage('检出代码') {
    environment {
        GIT_SSH_COMMAND = 'ssh -o StrictHostKeyChecking=no'
    }
    steps {
        checkout(...)
    }
}
```

---

## 📋 检查清单

在运行 Jenkins 构建前，确保：

- [ ] Git 凭证已在 Jenkins 中添加
- [ ] Jenkinsfile 中的 `credentialsId` 与添加的凭证 ID 一致
- [ ] Repository URL 正确
- [ ] Jenkins 服务器能访问 Git 服务器
- [ ] Git 用户在仓库中有权限
- [ ] 防火墙允许 Jenkins 连接 Git

---

## 🔐 安全最佳实践

1. **不要在代码中硬编码密码**
2. **使用 Jenkins 凭证系统管理敏感信息**
3. **优先使用 SSH 密钥而不是密码**
4. **定期轮换密钥和 Token**
5. **限制凭证的作用域**（使用特定的 Git 用户）

---

## 💾 导出/备份凭证配置

Jenkins 凭证存储在：
```bash
/var/lib/jenkins/credentials.xml
```

**备份**（仅管理员）：
```bash
sudo cp /var/lib/jenkins/credentials.xml /backup/credentials.xml.bak
```

---

## 📞 获取帮助

如果仍然无法解决，收集以下信息：

1. Jenkins 版本：Jenkins → 系统管理 → 系统信息
2. Git 插件版本：Jenkins → 系统管理 → 插件管理
3. Git 服务器信息：
   ```bash
   # 在 Jenkins 服务器运行
   git --version
   curl -I http://git.tsintergy.com:8070
   ```
4. Jenkins 日志：`/var/log/jenkins/jenkins.log`

---

## 快速修复（一步到位）

如果上面的步骤太复杂，使用这个简化的 Jenkinsfile：

```groovy
pipeline {
    agent any

    options {
        skipDefaultCheckout()
        disableConcurrentBuilds()
    }

    stages {
        stage('检出代码') {
            steps {
                script {
                    // 使用 HTTP 基础认证
                    sh '''
                        rm -rf e-file-parser-visualizer-v2
                        git clone --depth 1 \
                          --branch master \
                          http://shenjj:${GIT_PASSWORD}@git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git \
                          e-file-parser-visualizer-v2
                        cd e-file-parser-visualizer-v2
                    '''
                }
            }
        }

        stage('构建') {
            steps {
                sh '''
                    cd e-file-parser-visualizer-v2
                    npm ci
                    npm run build
                '''
            }
        }
    }
}
```

然后在 Jenkins 中配置环境变量：
- **GIT_PASSWORD**: 你的 Git 密码（作为密钥变量）

⚠️ **警告**：这种方法在密码可能暴露在日志中，生产环境应使用凭证系统。
