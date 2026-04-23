#!groovy

// extra_json_params
/**
固定参数，需要在参数配置中增加此配置项才能通过param.key使用
"env"
"alias_name"
"gitlab_address"
"gitlab_branch"
"rainbond_address"
"curl_rainbond_address"
"curl_rainbond_secretKey"
"if_clear_workspace"
"if_trigger_rainbond"

json参数，必须配置的项
"extra_json_params"
**/
def json_config

pipeline {
    agent {
        label "master"
    }

    options {
        // 限制保存构建的数量
        buildDiscarder(logRotator(numToKeepStr: '5'))
        // 禁止单个WorkSpace内发生并行构建
        disableConcurrentBuilds()
        // 构建超时时间 1小时
        timeout(time: 1, unit: 'HOURS')
    }

    stages {
        stage('parse json params') {
            steps {
                script {
                    if (!params.extra_json_params) {
                        echo "extra_json_params参数不能为空"
                        currentBuild.result = 'FAILURE'
                        sh "exit 1"
                    }
                    echo "json参数 -> ${params.extra_json_params}"
                    json_config = readJSON text: params.extra_json_params
                }
            }
        }

        stage('clear workspace') {
            when {
                expression {
                    return json_config.if_clear_workspace
                }
            }
            steps {
                script {
                    sh "rm -rf *"
                }
            }
        }

        stage('define environment') {
            steps {
                script {
                    // 分支
                    GIT_BRANCH = json_config.gitlab_branch
                    // 代码仓库地址
                    GIT_REPO = json_config.gitlab_address.endsWith(".git") ? json_config.gitlab_address : "${json_config.gitlab_address}.git"
                    // 构建目录
                    BUILD_DIR = "${WORKSPACE}/app"
                    // 镜像tag：etx:alias_name-env-yyyyMMddHHmmss
                    def date_tag = sh(script: "date +%Y%m%d%H%M%S", returnStdout: true).trim()
                    DOCKER_BUILD_TAG = "etx:${json_config.alias_name}-${json_config.env}-${date_tag}"
                    // 是否触发rainbond构建
                    IF_TRIGGER_RAINBOND = json_config.curl_rainbond_address && json_config.curl_rainbond_secretKey && json_config.if_trigger_rainbond
                }
            }
        }

        stage('checkout') {
            steps {
                ansiColor("xterm") {
                    dir("${BUILD_DIR}") {
                        checkout([
                            $class: 'GitSCM',
                            branches: [[name: "${GIT_BRANCH}"]],
                            userRemoteConfigs: [[
                                url: "${GIT_REPO}",
                                credentialsId: "1082e561-a22d-4cf2-b314-1d40f051afe6"
                            ]]
                        ])
                    }
                }
            }
        }

        stage('build & push image') {
            steps {
                ansiColor('xterm') {
                    dir("${BUILD_DIR}") {
                        script {
                            retry(2) {
                                sh "docker build -t ${DOCKER_BUILD_TAG} ."
                            }
                            sh "docker push ${DOCKER_BUILD_TAG}"
                            sh "docker rmi ${DOCKER_BUILD_TAG}"
                        }
                    }
                }
            }
        }

        stage('Trigger') {
            when {
                expression {
                    return IF_TRIGGER_RAINBOND
                }
            }
            steps {
                script {
                    sh "curl -d '{\"secret_key\": \"${json_config.curl_rainbond_secretKey}\"}' -H \"Content-type: application/json\" -X POST ${json_config.curl_rainbond_address}"
                }
            }
        }
    }

    post {
        always {
            sh 'docker image prune -f || true'
        }
    }
}
