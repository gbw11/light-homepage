# Jenkins 로컬 구성

이 디렉터리는 **개발 PC에서 Jenkins를 Docker로 띄우는 구성**입니다.
설계 배경·파이프라인 단계는 [`docs/CICD.md`](../../docs/CICD.md)를 먼저 읽으세요.

담당: `server_develop` (서버 배포·인프라)

---

## 1. 기동

```bash
cd infra/jenkins
docker compose up -d

# 초기 관리자 비밀번호
docker exec light-jenkins cat /var/jenkins_home/secrets/initialAdminPassword
```

접속: **http://localhost:8090**

> ⚠️ 포트 **8090**입니다. Spring Boot가 8080을 쓰므로 충돌을 피했습니다.

정지 / 완전 삭제:

```bash
docker compose down              # 컨테이너만 정지 (설정 유지)
docker compose down -v           # 볼륨까지 삭제 → Jenkins 설정 전부 초기화
```

---

## 2. 플러그인 (초기 설정 마법사에서 설치)

| 플러그인 | 용도 |
|---|---|
| Git · GitHub · GitHub Branch Source | 저장소 연동 · 커밋 상태 보고 |
| Pipeline · Multibranch Scan Webhook Trigger | 파이프라인 · 브랜치 자동 감지 |
| Docker Pipeline | 테스트용 Postgres 컨테이너 기동 |
| NodeJS | 프론트엔드 빌드 |
| Credentials Binding | 시크릿 주입 |
| Blue Ocean *(선택)* | 파이프라인 시각화 |

**Global Tool Configuration**에 NodeJS **22.x LTS**를 `node22` 이름으로 등록해야 합니다
(`Jenkinsfile`이 `tools { nodejs 'node22' }`로 참조합니다).

> ⚠️ 버전 22는 GitHub Actions·개발 PC와 맞춘 값입니다 — [`../../docs/TOOLCHAIN.md`](../../docs/TOOLCHAIN.md) §1.
> 여기만 다른 버전으로 등록하면 **Jenkins에서만 깨지는** 빌드가 생깁니다.

---

## 3. Credentials

Jenkins 관리 → Credentials → System → Global

| ID | 종류 | 용도 |
|---|---|---|
| `github-pat` | Secret text | 저장소 clone + 커밋 상태 보고 (`repo`, `status` 스코프) |
| `render-deploy-hook` | Secret text | Render 배포 트리거 URL |
| `db-test-password` | Secret text | 테스트용 Postgres 비밀번호 |

⚠️ **시크릿을 `Jenkinsfile`이나 이 저장소에 하드코딩하지 않습니다.** `credentials()`로만 참조합니다.

---

## 4. Multibranch Pipeline 생성

```
새 항목 → Multibranch Pipeline → 이름: light-homepage
  Branch Sources: GitHub
    Credentials: github-pat
    Repository: gbw11/light-homepage
    Behaviours: Discover branches (all) + Discover pull requests
  Build Configuration: by Jenkinsfile (경로: Jenkinsfile)
  Scan Repository Triggers:
    · 로컬 Jenkins → Periodically: 5분  (webhook 불가 → SCM 폴링)
```

`main` · `develop` · `*_develop` · `feat/*`가 자동 감지되어 각각 파이프라인이 생성됩니다.
**`feat/*`에서도 CI가 돌아야 머지 전에 결과를 확인할 수 있습니다** (`docs/CICD.md` §1.1).

---

## 5. 주의사항

| 항목 | 내용 |
|---|---|
| **docker.sock 마운트** | 파이프라인이 테스트용 Postgres를 띄우기 위해 호스트 Docker를 그대로 씁니다. Jenkins가 호스트 Docker를 완전히 제어하게 되므로 **공개 서버에 올릴 때는 반드시 접근을 제한하세요** |
| **`user: root`** | 위 docker.sock 접근 때문입니다. 로컬 전용 타협입니다 |
| **PC가 꺼지면 CI가 멈춥니다** | 그래서 GitHub Actions를 병행 유지합니다 (`docs/CICD.md` §3.2) |
| **webhook 불가** | 로컬은 외부에서 접근할 수 없어 5분 폴링을 씁니다. 공개 서버로 이전하면 webhook으로 바꿉니다 |

정식 운영으로 넘어갈 때는 **Oracle Cloud Always Free**로 이전합니다 (`docs/CICD.md` §3.1).
