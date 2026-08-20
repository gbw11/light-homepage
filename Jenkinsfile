// Jenkins Multibranch Pipeline — LIGHT 홈페이지
//
// 모든 브랜치(main · develop · *_develop · feat/*)를 자동 감지해 실행한다.
// 변경된 영역(frontend/ backend/)만 빌드하므로 불필요한 실행이 없다.
//
// 설정: docs/CICD.md §3
// ⚠️ Jenkins는 push를 막지 못한다. push 차단은 .githooks/pre-push 담당 (§1)

pipeline {
  agent any

  options {
    timestamps()
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '30'))
    timeout(time: 30, unit: 'MINUTES')
  }

  environment {
    // 테스트용 Postgres
    DB_NAME     = 'light_test'
    DB_USERNAME = 'postgres'
    DB_PASSWORD = 'postgres'
    // 테스트 전용 더미 시크릿 (운영 값 아님)
    JWT_SECRET  = 'jenkins-ci-test-secret-at-least-256-bits-long-for-hmac-sha256!!'
  }

  stages {

    // ────────────────────────────────────────────────
    stage('Detect Changes') {
      steps {
        script {
          // 이전 성공 커밋과 비교. 첫 빌드는 전체 실행
          def base = env.GIT_PREVIOUS_SUCCESSFUL_COMMIT ?: ''
          def changed = ''

          if (base) {
            changed = sh(returnStdout: true, script: "git diff --name-only ${base} HEAD || true").trim()
          } else {
            echo '이전 성공 빌드 없음 → 전체 검증'
            changed = 'frontend/ backend/'
          }

          env.FE_CHANGED = changed.contains('frontend/') ? 'true' : 'false'
          env.BE_CHANGED = changed.contains('backend/')  ? 'true' : 'false'

          // 파이프라인·CI 설정이 바뀌면 양쪽 모두 검증
          if (changed.contains('Jenkinsfile') || changed.contains('.github/')) {
            env.FE_CHANGED = 'true'
            env.BE_CHANGED = 'true'
          }

          echo "브랜치: ${env.BRANCH_NAME}"
          echo "프론트엔드 변경: ${env.FE_CHANGED} / 백엔드 변경: ${env.BE_CHANGED}"

          currentBuild.description = "FE:${env.FE_CHANGED} BE:${env.BE_CHANGED}"
        }
      }
    }

    // ────────────────────────────────────────────────
    stage('Verify') {
      parallel {

        // ─── 프론트엔드 ───
        stage('Frontend') {
          when {
            allOf {
              environment name: 'FE_CHANGED', value: 'true'
              expression { fileExists('frontend/package.json') }
            }
          }
          tools { nodejs 'node20' }   // Jenkins → Global Tool Configuration에 등록
          stages {
            stage('Install') {
              steps { dir('frontend') { sh 'npm ci' } }
            }
            stage('Lint') {
              steps { dir('frontend') { sh 'npm run lint' } }
            }
            stage('Type Check') {
              steps { dir('frontend') { sh 'npx tsc --noEmit' } }
            }
            stage('Build') {
              steps {
                dir('frontend') {
                  // mock 모드로 빌드 → 백엔드 없이도 검증 가능
                  sh 'NEXT_PUBLIC_USE_MOCK=1 npm run build'
                }
              }
            }
          }
        }

        // ─── 백엔드 ───
        stage('Backend') {
          when {
            allOf {
              environment name: 'BE_CHANGED', value: 'true'
              expression { fileExists('backend/gradlew') }
            }
          }
          steps {
            script {
              // 테스트용 Postgres를 컨테이너로 띄우고, 끝나면 자동 정리
              docker.image('postgres:16').withRun(
                "-e POSTGRES_DB=${DB_NAME} " +
                "-e POSTGRES_USER=${DB_USERNAME} " +
                "-e POSTGRES_PASSWORD=${DB_PASSWORD}"
              ) { db ->

                // DB 준비 대기
                sh """
                  for i in \$(seq 1 30); do
                    docker exec ${db.id} pg_isready -U ${DB_USERNAME} -q && break
                    sleep 2
                  done
                """

                def dbIp = sh(returnStdout: true, script:
                  "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' ${db.id}"
                ).trim()

                dir('backend') {
                  withEnv([
                    "SPRING_PROFILES_ACTIVE=test",
                    "DATABASE_URL=jdbc:postgresql://${dbIp}:5432/${DB_NAME}",
                    "DB_USERNAME=${DB_USERNAME}",
                    "DB_PASSWORD=${DB_PASSWORD}",
                    "JWT_SECRET=${JWT_SECRET}"
                  ]) {
                    sh 'chmod +x ./gradlew'
                    sh './gradlew compileJava compileTestJava --no-daemon'

                    // ★ 인가 매트릭스 — RLS가 없는 이 프로젝트의 마지막 방어선
                    //   (ARCHITECTURE.md §5.3). 실패 시 즉시 중단한다.
                    sh './gradlew test --tests "*Authorization*" --no-daemon'

                    // 전체 테스트 + 빌드
                    sh './gradlew build --no-daemon'
                  }
                }
              }
            }
          }
          post {
            always {
              junit allowEmptyResults: true, testResults: 'backend/build/test-results/test/*.xml'
              archiveArtifacts artifacts: 'backend/build/reports/tests/**',
                               allowEmptyArchive: true, fingerprint: false
            }
          }
        }
      }
    }

    // ────────────────────────────────────────────────
    stage('Quality Gate') {
      steps {
        script {
          if (currentBuild.result == 'UNSTABLE') {
            error('테스트가 UNSTABLE 상태입니다 — 배포를 진행하지 않습니다')
          }
          echo '✓ 모든 검증 통과'
        }
      }
    }

    // ────────────────────────────────────────────────
    // CD — main 브랜치이고 모든 검증을 통과했을 때만
    // ⚠️ Render의 Auto-Deploy는 반드시 꺼둘 것 (docs/CICD.md §5.2)
    //    켜져 있으면 테스트를 기다리지 않고 push 즉시 배포된다.
    // ────────────────────────────────────────────────
    stage('Deploy') {
      when { branch 'main' }
      steps {
        script {
          if (env.BE_CHANGED == 'true') {
            withCredentials([string(credentialsId: 'render-deploy-hook', variable: 'HOOK')]) {
              sh 'curl -fsS -X POST "$HOOK" > /dev/null'
            }
            echo '백엔드 배포 트리거 (Render)'
          } else {
            echo '백엔드 변경 없음 → 배포 생략'
          }
          // 프론트엔드는 Vercel의 GitHub 연동이 자동 배포한다 (Jenkins 개입 불필요)
          echo '프론트엔드는 Vercel이 자동 배포합니다'
        }
      }
    }
  }

  // ────────────────────────────────────────────────
  post {
    success {
      echo "✓ ${env.BRANCH_NAME} #${env.BUILD_NUMBER} 성공"
    }
    failure {
      echo "✗ ${env.BRANCH_NAME} #${env.BUILD_NUMBER} 실패"
      script {
        // 통합 브랜치 이상에서 깨지면 상대 작업까지 막힌다 → 즉시 알림
        def critical = ['main', 'develop', 'frontend_develop', 'backend_develop', 'server_develop']
        if (critical.contains(env.BRANCH_NAME)) {
          echo "⚠️ 통합 브랜치 실패 — 상대에게 즉시 공유하고 우선 수정하세요"
        }
      }
    }
    cleanup {
      cleanWs(deleteDirs: true, notFailBuild: true)
    }
  }
}
