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
| `github-pat` | **Username with password** | 저장소 clone + 커밋 상태 보고 (Username: GitHub 아이디, Password: PAT) |
| `render-deploy-hook` | Secret text | Render 배포 트리거 URL |
| `db-test-password` | Secret text | 테스트용 Postgres 비밀번호 |

⚠️ **시크릿을 `Jenkinsfile`이나 이 저장소에 하드코딩하지 않습니다.** `credentials()`로만 참조합니다.

> ⚠️ `github-pat`을 **Secret text**로 등록하면 GitHub Branch Source의 Credentials
> 드롭다운에 나타나지 않습니다. 반드시 **Username with password**로 등록하세요
> (Username은 GitHub 아이디, Password에 PAT). Classic PAT(`repo` 스코프)이
> Fine-grained PAT보다 설정이 단순하고 실패 사례가 적어 권장합니다.

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

---

## 6. 구축 기록 (2026-08-21)

로컬 Jenkins 최초 구축을 완료했습니다. 이후 같은 작업을 반복하거나 재구축할 때
참고할 실전 트러블슈팅 기록입니다.

### 6.1 플러그인 설치가 대량으로 실패할 때

초기 설정 마법사에서 플러그인을 설치하면 Jenkins 업데이트 센터가 지역 미러
(`mirror.ossplanet.net` 등)로 리다이렉트하는데, 이 미러가 간헐적으로 응답이
느려 20초 타임아웃으로 실패하는 경우가 있었습니다(Pipeline·Git·GitHub 등
핵심 플러그인 포함). UI에서 재시도해도 같은 미러로 다시 걸리면 또 실패합니다.

**해결**: 컨테이너에 내장된 `jenkins-plugin-cli`로 직접 설치하면 재시도·미러
전환 로직이 내장돼 있어 훨씬 안정적입니다.

```bash
docker exec -u root light-jenkins jenkins-plugin-cli --plugins <plugin-id-1> <plugin-id-2> ... --verbose
docker restart light-jenkins   # 설치 후 반드시 재시작해야 로드됨
```

### 6.2 GitHub Branch Source Credentials 드롭다운에 안 보임

`github-pat`을 **Secret text**로 등록하면 Multibranch Pipeline의 GitHub
Credentials 선택 목록에 나타나지 않습니다. **Username with password**로
등록해야 합니다 (§3 참고).

### 6.3 `FATAL: Invalid scan credentials`

토큰 자체가 유효한데도 이 오류가 나면, Jenkins에 저장된 Password 값이
실제 토큰이 아닌 다른 텍스트(예: 다른 곳에서 복사한 API 응답 등)로
잘못 입력된 경우가 있습니다. Script Console(`/script`)에서 저장된 값의
길이·공백 여부를 직접 확인하면 빠르게 진단됩니다:

```groovy
def c = com.cloudbees.plugins.credentials.CredentialsProvider.lookupCredentials(com.cloudbees.plugins.credentials.common.StandardUsernamePasswordCredentials.class, jenkins.model.Jenkins.instance, null, null).find { it.id == 'github-pat' }
def pw = c.password.plainText
println([user: c.username, len: pw.length(), trimmed_diff: (pw != pw.trim())])
def conn = new URL('https://api.github.com/user').openConnection()
conn.setRequestProperty('Authorization', 'Basic ' + "${c.username}:${pw}".bytes.encodeBase64().toString())
println conn.responseCode
```
(정상 PAT은 길이 40자 안팎, `trimmed_diff: false`, 응답 코드 200)

### 6.4 ⚠️ 저장소의 "Automatically delete head branches"와 영구 브랜치 충돌

GitHub 저장소 기본 설정에 **"Automatically delete head branches"**가 켜져
있으면, PR이 머지되는 순간 그 head 브랜치가 삭제됩니다. `feat/*` 임시
브랜치에는 맞는 동작이지만, **`server_develop`처럼 영구 보존해야 하는
통합 브랜치가 다른 브랜치로의 PR head가 되면(예: `server_develop → develop`)
똑같이 삭제됩니다** — 실제로 이 사고가 발생해 `server_develop`이 삭제됐고
마지막 커밋으로 재생성해서 복구했습니다.

**조치 완료**: 저장소 Settings → General → Pull Requests → "Automatically
delete head branches" **해제**.

**주의**: `backend_develop`/`frontend_develop`도 향후 `develop`으로의 PR
head가 될 수 있으므로, 이 설정이 다시 켜지지 않도록 유지해야 합니다.

### 6.5 현재 상태 (2026-08-21 기준)

| 항목 | 상태 |
|---|---|
| Jenkins | 로컬 Docker, `http://localhost:8090` |
| NodeJS 툴 | `node20`, `node22` 둘 다 등록 |
| Credentials | `github-pat` ✅, `db-test-password` ✅, `render-deploy-hook` ⏳ 미등록 (Render 배포 설정 시 등록 필요) |
| Multibranch Pipeline | `light-homepage` 생성 완료, 전 브랜치 CI green |
| 미해결 | Render Deploy Hook 발급 전까지 CD(배포) 단계는 동작하지 않음 (`docs/CICD.md` §5.2) |
