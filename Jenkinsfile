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
                    checkout scm
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
                            # 设置 Rainbond API 信息
                            RAINBOND_URL="${RAINBOND_API_URL:-http://localhost:8080}"
                            TEAM_NAME="${RAINBOND_TEAM:-default}"
                            APP_NAME="${IMAGE_NAME}"

                            # 部署或更新应用
                            curl -X POST \
                              -H "Authorization: Bearer ${RAINBOND_TOKEN}" \
                              -H "Content-Type: application/json" \
                              -d "{
                                \"app_name\": \"${APP_NAME}\",
                                \"docker_image\": \"${FULL_IMAGE}\",
                                \"port\": 3000,
                                \"env\": {
                                  \"NODE_ENV\": \"production\"
                                }
                              }" \
                              ${RAINBOND_URL}/api/v1/teams/${TEAM_NAME}/apps

                            echo "Rainbond 部署请求已发送"
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
