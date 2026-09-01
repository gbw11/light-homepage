// Jenkins Multibranch Pipeline — LIGHT 홈페이지
//
// 모든 브랜치(main · develop · *_develop · feat/*)를 자동 감지해 실행한다.
// 변경된 영역(frontend/ backend/)만 빌드하므로 불필요한 실행이 없다.
//
// 설정: docs/ops/CICD.md §3
// ⚠️ CI는 push를 막지 못한다. 통제 지점은 "머지"다 — CI가 ❌면 머지하지 않는다 (§1·§4)

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
    // 테스트 전용 더미 시크릿 (운영 값 아님) — allowlist-secret
    JWT_SECRET  = 'jenkins-ci-test-secret-at-least-256-bits-long-for-hmac-sha256!!'  // allowlist-secret
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
    // ⚠️ Secret Scan은 여기에 없다 — 2026-08-27에 GitHub Actions로 옮겼다.
    //
    // Jenkins는 PM 로컬 PC에 있다. PC가 꺼져 있으면 시크릿 검사가 한 번도 돌지
    // 않는데, 그 사실이 아무 신호 없이 지나간다. 실제로 2026-08-27에 하루 종일
    // Jenkins가 돌지 않아 시크릿 감지가 통째로 비어 있었다.
    // 사람의 PC 상태에 달린 방어는 방어가 아니다 — CD를 옮긴 것과 같은 이유다.
    //
    // 지금은 `.github/workflows/secret-scan.yml`이 한다 (모든 브랜치 push + PR).
    // 두 곳에 두면 정규식을 두 곳에서 관리하게 되므로 여기서는 하지 않는다.
    //
    // 근거: docs/ops/CICD.md §1.3 · docs/records/DECISIONS.md 2026-08-27
    // ────────────────────────────────────────────────
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
          // ⚠️ GitHub Actions(setup-node 22)와 반드시 같은 메이저를 쓴다 (docs/ops/TOOLCHAIN.md §1)
          //    한쪽만 다르면 로컬·Actions는 통과하고 Jenkins에서만 깨져 원인 추적에 시간이 든다.
          tools { nodejs 'node22' }   // Jenkins → Global Tool Configuration에 등록
          stages {
            stage('Install') {
              steps { dir('frontend') { sh 'npm ci' } }
            }
            stage('Lint') {
              steps { dir('frontend') { sh 'npm run lint' } }
            }
            stage('Type Check') {
              // next typegen이 라우트 타입을 먼저 만들어야 tsc가 통과한다 (Next 16)
              steps { dir('frontend') { sh 'npm run type-check' } }
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
    // ⚠️ CD(배포)는 여기에 없다 — 2026-08-26에 GitHub Actions로 옮겼다.
    //
    // Jenkins는 PM 로컬 PC에 있다. PC가 꺼져 있으면 배포가 일어나지 않으므로
    // "머지하면 서버에 올라간다"가 성립하지 않는다. 자동 배포가 사람의 PC
    // 상태에 달려 있으면 그건 자동이 아니다.
    //
    // 지금 배포는 `.github/workflows/backend-ci.yml`의 `deploy` 잡이 한다
    // (develop push + 검증 통과 시 Render Deploy Hook 호출).
    // 두 곳에서 트리거하면 같은 커밋이 두 번 배포되므로 여기서는 하지 않는다.
    //
    // 근거: docs/ops/CICD.md §3.2 · §5 · docs/records/DECISIONS.md 2026-08-26
    // Jenkins가 상시 가동 서버(Oracle Cloud)로 이전하면 다시 가져올 수 있다.
    // ────────────────────────────────────────────────
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
