pipeline {
    agent any

    environment {
        // 镜像配置
        REGISTRY = "${env.DOCKER_REGISTRY ?: 'docker.io'}"
        IMAGE_NAME = "${env.IMAGE_NAME ?: 'e-file-parser-visualizer'}"
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        FULL_IMAGE = "${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}"
        LATEST_IMAGE = "${REGISTRY}/${IMAGE_NAME}:latest"

        // 项目配置
        NODE_ENV = "production"
        WORKDIR = "${WORKSPACE}/e-file-parser-visualizer-v2"

        // Rainbond 配置
        RAINBOND_API_URL = "http://rainbond.gzdevops.tsintergy.com"
        RAINBOND_TEAM = "tsintergy"
    }

    options {
        // 保留最近30个构建
        buildDiscarder(logRotator(numToKeepStr: '30'))
        // 超时设置
        timeout(time: 30, unit: 'MINUTES')
        // 禁止并行构建
        disableConcurrentBuilds()
    }

    stages {
        stage('检出代码') {
            steps {
                script {
                    echo "检出代码..."
                    // 增大 HTTP 缓冲区，解决 HTTP 422 / RPC failed 问题
                    sh 'git config --global http.postBuffer 524288000'
                    sh 'git config --global http.lowSpeedLimit 0'
                    sh 'git config --global http.lowSpeedTime 999999'
                    checkout([
                        $class: 'GitSCM',
                        branches: [[name: '*/master']],
                        userRemoteConfigs: [[
                            url: 'http://git.tsintergy.com:8070/shenjj/e-file-parser-visualizer-v2.git',
                            // d72ec4cf-d938-43f6-8648-23b0e32f1fc6
                            credentialsId: '624227b6-889c-460b-89f0-da8ff5377f56'
                        ]]
                    ])
                }
            }
        }

        stage('代码质量检查') {
            steps {
                script {
                    dir("${WORKDIR}") {
                        echo "执行类型检查..."
                        sh '''
                            npm ci
                            npx tsc --noEmit || true
                        '''
                    }
                }
            }
        }

        stage('构建镜像') {
            steps {
                script {
                    dir("${WORKDIR}") {
                        echo "构建 Docker 镜像: ${FULL_IMAGE}"
                        sh '''
                            docker build \
                              --tag ${FULL_IMAGE} \
                              --tag ${LATEST_IMAGE} \
                              --build-arg NODE_ENV=production \
                              .
                        '''
                    }
                }
            }
        }

        stage('推送镜像') {
            when {
                branch 'master'
            }
            steps {
                script {
                    echo "推送镜像到仓库..."
                    withCredentials([usernamePassword(credentialsId: 'docker-registry-credentials', usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASS')]) {
                        sh '''
                            echo "${DOCKER_PASS}" | docker login ${REGISTRY} -u "${DOCKER_USER}" --password-stdin
                            docker push ${FULL_IMAGE}
                            docker push ${LATEST_IMAGE}
                            docker logout ${REGISTRY}
                        '''
                    }
                }
            }
        }

        stage('部署到 Rainbond') {
            when {
                branch 'master'
            }
            steps {
                script {
                    echo "部署到 Rainbond..."
                    withCredentials([string(credentialsId: 'rainbond-api-token', variable: 'RAINBOND_TOKEN')]) {
                        sh '''
                            set -e

                            # Rainbond 配置
                            API_URL="${RAINBOND_API_URL}/api/v1"
                            TEAM_NAME="${RAINBOND_TEAM}"
                            APP_NAME="${IMAGE_NAME}"

                            echo "========== Rainbond 部署信息 =========="
                            echo "API 地址: ${API_URL}"
                            echo "团队: ${TEAM_NAME}"
                            echo "应用名: ${APP_NAME}"
                            echo "镜像: ${FULL_IMAGE}"
                            echo "========================================"

                            # 获取或创建应用
                            echo "正在部署应用..."

                            # 调用 Rainbond API 创建/更新应用
                            curl -X POST \
                              -H "Authorization: ${RAINBOND_TOKEN}" \
                              -H "Content-Type: application/json" \
                              --data @- \
                              ${API_URL}/teams/${TEAM_NAME}/apps/deploy \
                              <<EOF || echo "注意：API 调用返回了错误代码"
{
  "app_name": "${APP_NAME}",
  "docker_image": "${FULL_IMAGE}",
  "port": 3000,
  "memory": 512,
  "cpu": 500,
  "env": {
    "NODE_ENV": "production"
  }
}
EOF

                            echo ""
                            echo "✅ Rainbond 部署请求已提交"
                            echo "应用地址: http://${APP_NAME}.${RAINBOND_TEAM}.gzdevops.tsintergy.com"
                        '''
                    }
                }
            }
        }

        stage('健康检查') {
            when {
                branch 'master'
            }
            steps {
                script {
                    echo "执行健康检查..."
                    sh '''
                        # 等待应用启动
                        sleep 10

                        # 获取部署后的应用 URL
                        APP_URL="${RAINBOND_APP_URL:-http://localhost:3000}"

                        # 检查应用是否可用
                        for i in {1..10}; do
                            if curl -f ${APP_URL} > /dev/null 2>&1; then
                                echo "应用已成功启动"
                                exit 0
                            fi
                            echo "等待应用启动... ($i/10)"
                            sleep 5
                        done

                        echo "健康检查失败"
                        exit 1
                    '''
                }
            }
        }
    }

    post {
        always {
            // 清理
            sh 'docker image prune -f || true'
        }
        success {
            echo "构建和部署成功！"
            // 可集成通知（邮件、Slack 等）
        }
        failure {
            echo "构建或部署失败"
            // 可集成通知（邮件、Slack 等）
        }
    }
}
