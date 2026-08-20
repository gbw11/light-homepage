# Git 훅 — 설치 필수

## 설치 (clone 직후 1회, 각자 실행)

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-push        # Windows는 Git Bash에서
```

확인:
```bash
git config core.hooksPath          # → .githooks 가 출력돼야 함
```

⚠️ **이 설정을 안 하면 훅이 동작하지 않습니다.** `.git/hooks`는 저장소에 커밋되지 않으므로 `core.hooksPath`로 경로를 지정해야 합니다.

---

## `pre-push` 가 하는 일

push 직전에 3가지를 검사하고, 하나라도 실패하면 **push를 중단**합니다.

| # | 검사 | 실패 시 |
|---|---|---|
| 1 | **보호 브랜치 직접 push 차단**<br>(`main` `develop` `frontend_develop` `backend_develop` `server_develop`) | 중단 + PR 절차 안내 |
| 2 | **시크릿 포함 여부**<br>`.env` · `application-local.yml` · JWT_SECRET · R2 키 · PEM · DB URL | 중단 |
| 3 | **빠른 테스트** (변경된 영역만)<br>FE: lint + 타입체크 / BE: 인가 매트릭스 | 중단 |

목표 실행 시간 **90초 이내**. 전체 테스트는 Jenkins가 담당합니다.

---

## 왜 pre-push인가

**Jenkins도 GitHub Actions도 push를 막을 수 없습니다.** push가 먼저 일어나고 CI는 그 뒤에 실행되기 때문입니다. 실제로 "테스트 실패 시 업로드 차단"을 구현하는 유일한 지점이 pre-push 훅입니다.

특히 **시크릿 검사**는 push 전이 유일하게 의미 있는 시점입니다. GitHub에 한 번 올라간 시크릿은 히스토리에서 지우기 어렵고 키를 재발급해야 합니다.

그리고 **보호 브랜치 차단**은 무료 Private 저장소에서 GitHub 브랜치 보호를 쓸 수 없어(`docs/INTEGRATION.md §6.11`) 생긴 공백을 메웁니다.

자세한 설계는 [`../docs/CICD.md`](../docs/CICD.md) §1~2

---

## 상황별 안내

### 백엔드 테스트가 건너뛰어짐
```
! 로컬 Postgres(5432) 미실행 → 테스트 건너뜀
```
로컬 DB를 띄우면 검사됩니다.
```bash
docker start light-db
# 없으면:
docker run -d --name light-db -p 5432:5432 \
  -e POSTGRES_PASSWORD=local -e POSTGRES_DB=light postgres:16
```
건너뛰어도 push는 됩니다. Jenkins가 최종 검증합니다.

### 프론트엔드 검사가 건너뛰어짐
```
! node_modules 없음 → 건너뜀
```
`cd frontend && npm ci` 후 다시 push하세요.

### 시크릿 검사가 오탐할 때
CI용 더미 값처럼 **의도적으로 커밋해야 하는 값**은 해당 줄에 `allowlist-secret` 주석을 붙입니다.

```groovy
JWT_SECRET = 'jenkins-ci-test-secret-...'  // allowlist-secret
```

⚠️ **실제 시크릿에 이 표시를 붙이지 마세요.** 검사를 무력화하는 것이 아니라,
"이 값은 공개돼도 무해하다"고 명시적으로 선언하는 용도입니다.

### 훅을 우회해야 할 때
```bash
git push --no-verify
```
정당한 경우: 훅 자체가 고장났을 때, WIP를 개인 브랜치에 백업할 때.

⚠️ **보호 브랜치에는 `--no-verify`로도 올리지 않습니다.** 이건 도구가 아니라 팀 규칙입니다.

### 훅이 아예 실행되지 않음
```bash
git config core.hooksPath            # .githooks 인지 확인
ls -l .githooks/pre-push             # 실행 권한 있는지 확인
chmod +x .githooks/pre-push
```
Windows에서 `sh`를 못 찾는다면 Git Bash 환경에서 push하세요.
