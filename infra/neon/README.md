# Neon 백업·복원 절차

`SPEC_NONFUNCTIONAL.md`가 요구하는 것:

| 요구 | 값 |
|---|---|
| **NFR-OPS-06** | DB 백업 — **일 1회** (Neon 기본 또는 수동 덤프) |
| **NFR-AVAIL-09** | RPO(데이터 손실 허용) — **24시간** |
| **NFR-AVAIL-08** | RTO(복구 목표 시간) — 24시간 |

담당: PM/인프라 (`server_develop` — [`../../docs/INTEGRATION.md §6`](../../docs/INTEGRATION.md))
관련: [`../render/README.md`](../render/README.md) · [`../../docs/COST_GUARDRAILS.md`](../../docs/COST_GUARDRAILS.md)

---

## 0. 지금은 급하지 않다. 그러나 나중에는 늦다

**2026-08-27 현재 DB에 데이터가 0건이다** (`/api/posts` → `{"items":[]}`).
백업이 없어도 잃을 것이 없다.

문제는 **첫 주보가 올라간 순간부터 되돌릴 수 없다는 것**이다. 사진첩은 특히
그렇다 — 교회 행사 사진은 다시 찍을 수 없다. 그래서 **데이터가 쌓이기 시작하는
시점(M2 인증 배포 직후)에 이 절차가 돌아가고 있어야 한다.**

> ⚠️ R2(사진·주보 파일)는 이 문서 범위가 아니다. DB에는 **경로와 메타데이터만**
> 있고 파일 자체는 R2에 있다. **DB만 복원하면 파일을 가리키는 링크만 살아난다.**
> R2 백업은 M3에서 별도로 정한다 (`COST_GUARDRAILS.md §3.6` 결정 후).

---

## 0.5 최초 관리자(PASTOR) 계정 만들기 — DB를 만들 때 한 번

> **PM 결정 2026-08-27 — D안: 정상 가입 후 `role`만 UPDATE**
> (`../../docs/DECISIONS.md`)

### 왜 이 절차가 필요한가

| 사실 | 근거 |
|---|---|
| 가입은 **항상 `role=PENDING`** | `AuthService` — "가입 결과는 항상 role=PENDING이다" |
| 승인 API는 **`PASTOR`(T) 권한** | `SPEC_API §8.1~8.4` · 인가 매트릭스 `401/403/403/403/200` |
| DB에 시드 계정 **없음** | `V1__init.sql` — INSERT 없음, `role` DEFAULT `'PENDING'` |

**→ PASTOR가 0명이면 아무도 아무것도 승인할 수 없다.** 전도사님이 가입해도
PENDING이고, 승인해 줄 사람이 없다.

### 왜 D안인가 (다른 안을 쓰지 않는 이유)

- **BCrypt 해시를 만들지 않는다** — 가입 화면을 거치면 앱이 만든다
  (`SecurityConfig:188` `BCryptPasswordEncoder()`)
- **시크릿을 생산하지 않는다** — 저장소·마이그레이션·환경변수에 아무것도 남지 않는다
- **비밀번호를 본인이 정한다** — 관리자가 정해서 전달하고 나중에 바꾸게 하는 과정이 없다
- **코드 변경이 없다** — 부트스트랩 경로가 운영에 영구히 남지 않는다

### 절차

**① 전도사님이 화면에서 정상 가입한다**

`/signup`에서 평소처럼 가입한다 → `role=PENDING`, `password_hash`는 앱이 BCrypt로 저장.

> ⚠️ **가입 폼이 "소속 마을"을 필수로 요구한다** (`SignupRequest` —
> `^([1-9]|newcomer)$`). 전도사는 마을 소속이 아닐 수 있는데 폼이 강제하므로
> **아무 값이나 골라야 한다.** 아래 ②에서 함께 정리한다.

**② Neon 콘솔(SQL Editor)에서 한 줄**

```sql
UPDATE members
   SET role        = 'PASTOR',
       approved_at = now(),
       village     = NULL          -- ①의 임시 마을값 정리. 실제로 마을 소속이면 이 줄을 지운다
 WHERE email = '전도사님이 가입에 쓴 이메일';
```

실행 후 `UPDATE 1`이 나와야 한다. `UPDATE 0`이면 이메일이 다르다 —
`SELECT id, email, name, role FROM members;`로 확인한다.

**③ 🔴 반드시 다시 로그인한다**

**`role`은 JWT 클레임에 담긴다** (`JwtProvider` — `CLAIM_ROLE = "role"`, 요청마다
DB를 다시 읽지 않는다). ②를 실행해도 **이미 발급된 토큰은 계속 `PENDING`**이다.

→ 로그아웃 후 다시 로그인하면 `PASTOR` 권한 토큰이 발급된다.

### 확인

로그인 후 `/admin/members`가 열리면 끝이다 (FE 가드가 `RequirePastor`).
그 화면에서 이후 가입자를 직접 승인할 수 있다.

```bash
# 또는 API로 직접
curl -i https://light-homepage.onrender.com/api/admin/members?status=PENDING   -H "Cookie: <로그인 후 쿠키>"
# → 200 (403이면 ③ 재로그인을 안 한 것이다)
```

### 이 절차를 다시 해야 하는 때

**DB를 새로 만들었을 때만이다.** 한 번 만들면 다시 0명이 될 수 없다 —
`SPEC_API §8.4`가 **마지막 `PASTOR` 강등을 `VALIDATION_ERROR`로 막는다**
("아무도 회원을 승인할 수 없게 되는 것을 방지"). 즉 이 교착은 **초기 1회만**
존재한다.

---

## 1. 수단은 두 가지다

| 수단 | 무엇 | 사람이 할 일 | 상태 |
|---|---|---|---|
| **Neon PITR** | Neon이 제공하는 특정 시점 복구 | 없음 (자동) | ⚠️ **Free 플랜 보존 기간을 대시보드에서 확인해야 한다** |
| **수동 `pg_dump`** | 파일로 받아 보관 | 사람이 돌린다 | ⬜ 절차만 준비됨 (아래) |

> ### ⚠️ Neon Free의 PITR 보존 기간은 이 문서를 쓴 시점에 확인하지 못했다
>
> Neon은 무료 플랜 조건을 여러 번 바꿨다. **대시보드에서 실물로 확인할 것**
> (`Neon → 프로젝트 → Branches` 또는 `Settings → History retention`).
>
> - 보존 기간이 **7일 이상**이면 → PITR만으로 NFR-OPS-06(일 1회)·RPO 24시간을
>   충족한다. 수동 덤프는 "월말 1회 보관용"으로만 돌린다
> - 보존 기간이 **24시간 이하**거나 없으면 → **수동 덤프가 유일한 수단**이다.
>   §2를 주 1회 이상 돌려야 한다

---

## 2. 수동 덤프 절차

### 2.1 준비 — `pg_dump` 16이 필요하다

⚠️ **PM 로컬 환경에는 설치돼 있지 않다** (2026-08-27 `pg_dump --version` 확인).
둘 중 하나를 고른다.

**(a) PostgreSQL 16 클라이언트 설치** — 한 번 하면 계속 쓴다
**(b) Docker로 일회성 실행** — 설치하지 않는다. Docker Desktop이 켜져 있어야 한다

> 서버 버전과 `pg_dump` 버전을 맞춘다. **`pg_dump` 15로 16 서버를 덤프하면
> 거부된다** (`server version mismatch`). `TOOLCHAIN.md §1`이 Postgres를 **16**으로
> 고정했다.

### 2.2 연결 문자열 — ⚠️ Render에 넣은 값을 그대로 쓰면 안 된다

Render 환경변수의 `DATABASE_URL`은 **JDBC 형식**이다. `pg_dump`는 **libpq 형식**을
받는다. 어제 Render 설정에서 한 변환의 **역방향**이 필요하다.

| 용도 | 형식 |
|---|---|
| Render `DATABASE_URL` | `jdbc:postgresql://ep-xxx.../light?sslmode=require` |
| **`pg_dump`** | `postgresql://사용자:비밀번호@ep-xxx.../light?sslmode=require` |

**Neon 콘솔의 Connection string을 그대로 복사하는 것이 가장 안전하다** — 변환하다
`jdbc:`를 남기거나 비밀번호를 빼먹는 실수를 없앤다.

### 2.3 덤프

```bash
# (a) pg_dump가 설치된 경우
pg_dump "postgresql://<user>:<pw>@<host>/light?sslmode=require" \
  --no-owner --no-privileges \
  -Fc -f "light-$(date +%Y%m%d).dump"

# (b) Docker로 (설치 없이)
docker run --rm -v "$PWD:/out" postgres:16 \
  pg_dump "postgresql://<user>:<pw>@<host>/light?sslmode=require" \
  --no-owner --no-privileges \
  -Fc -f "/out/light-$(date +%Y%m%d).dump"
```

- **`--no-owner --no-privileges`** — Neon의 롤 이름이 복원 대상과 다를 수 있다.
  없으면 복원 시 `role "light_owner" does not exist`로 멈춘다
- **`-Fc`**(custom format) — 압축되고, 복원 시 테이블 선택이 가능하다

---

## 3. 🔴 덤프 파일은 개인정보다

덤프에는 **13개 테이블 전부**가 들어간다. 그중 둘이 개인정보를 담는다.

| 테이블 | 무엇 | 규칙 |
|---|---|---|
| `members` | 계정·이름·연락처 | 회원제 개인정보 |
| `newcomer_requests` | 새가족 등록 정보 | ⚠️ **보유기간 1년 후 삭제** (`SPEC_API §8.6`) |

**지켜야 할 것**

- **절대 저장소에 커밋하지 않는다.** `*.dump`·`*.sql` 산출물을 커밋 대상에 올리지
  않는다 (§6 체크리스트에 `.gitignore` 확인 항목이 있다)
- **공유 클라우드 폴더에 평문으로 두지 않는다.** 두려면 암호를 걸어 압축한다
- **보관 기준을 정한다** — 예: 최근 7개 + 월말 1개. 무한히 쌓지 않는다

> ### ⚠️ 보유기간 1년 규칙은 **백업에도 적용된다**
>
> `newcomer_requests`를 DB에서 1년 후 삭제해도, **그 시점 이전의 덤프 파일에는
> 그 정보가 그대로 남아 있다.** 백업을 영구 보관하면 삭제 규칙이 무력화된다.
>
> 그래서 오래된 덤프를 **지우는 것도 절차의 일부**다. 위 "최근 7개 + 월말 1개"에서
> 월말 보관분도 **1년이 지나면 폐기**한다.
>
> ⚠️ 참고: **DB 쪽 1년 삭제 배치가 아직 구현되지 않았다** (2026-08-27 확인 —
> 코드에 주석만 있고 `@Scheduled` 작업이 없다). BE에게 전달했다.

---

## 4. 복원 절차

### 4.1 ⚠️ 부분 복원을 하지 않는다 — Flyway가 깨진다

덤프에는 **`flyway_schema_history` 테이블도 포함된다.** 이 표가 "지금 스키마가
어느 버전인지"를 기록한다.

```
테이블 몇 개만 복원  →  실제 스키마와 flyway_schema_history가 어긋남
                          ↓
                     다음 배포에서 Flyway validate 실패 → 기동 실패
```

**원칙: 전체 복원.** 특정 테이블만 되살려야 한다면, 임시 DB에 전체를 복원한 뒤
필요한 행만 옮긴다.

> 이건 나쁜 성질이 아니다. `application.yml`이 `ddl-auto: validate`라서
> **스키마가 어긋나면 조용히 넘어가지 않고 기동에 실패한다.** 어긋난 채로
> 서비스가 도는 것보다 낫다.

### 4.2 복원

```bash
# 대상 DB를 비우고 복원한다 (⚠️ 되돌릴 수 없다 — 대상 주소를 두 번 확인할 것)
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://<user>:<pw>@<host>/light?sslmode=require" \
  light-YYYYMMDD.dump
```

### 4.3 복원 후 확인

```bash
curl -i https://light-homepage.onrender.com/actuator/health
# → 200  {"status":"UP", ...}   ★ DB 인디케이터가 포함되므로 연결·스키마가 함께 확인된다

curl -i "https://light-homepage.onrender.com/api/posts?category=NOTICE_PUBLIC"
# → 200  복원한 글이 보이는지
```

⚠️ 스키마가 어긋났다면 `/actuator/health`가 아니라 **기동 자체가 실패**한다.
Render Logs를 본다 ([`../render/README.md §2.5`](../render/README.md)).

---

## 5. 지금 자동화하지 않는 이유

"GitHub Actions cron으로 매일 덤프하면 되지 않나"가 자연스러운 생각이지만,
셋 다 걸린다.

| 문제 | 내용 |
|---|---|
| **Actions 무료 분** | Private 저장소는 실행이 무료 분에서 차감되고 **최소 1분 과금**이다 (`COST_GUARDRAILS.md §3.1`) |
| **🔴 덤프를 어디 두나** | Actions artifact에 올리면 **개인정보를 GitHub에 저장하는 것**이 된다. §3 규칙과 충돌한다 |
| **시크릿** | DB 비밀번호를 워크플로에 넣어야 한다. 저장소 시크릿이 하나 늘고, 로그 유출 경로도 늘어난다 |

**→ 지금은 Neon PITR + 필요 시 수동 덤프.** 데이터가 실제로 쌓이고 R2 백업까지
같이 정할 때(M3) 다시 본다.

---

## 6. 체크리스트

**한 번만 (지금)**
- [ ] Neon 대시보드에서 **PITR 보존 기간 확인** → §1의 두 갈래 중 어느 쪽인지 결정
- [ ] `.gitignore`에 `*.dump`가 걸려 있는지 확인 (없으면 추가)
- [ ] 덤프 보관 위치와 보관 기준 정하기 (최근 7개 + 월말 1개 권장)

**첫 실데이터가 들어온 뒤 (M2 배포 직후)**
- [ ] §2 덤프를 **한 번 실제로 돌려본다**
- [ ] 🔴 **복원 리허설 1회** — **해본 적 없는 백업은 백업이 아니다.**
      Neon의 브랜치 기능으로 원본을 건드리지 않고 시험할 수 있는 것으로 보이지만
      (⚠️ 미확인), 안 되면 별도 프로젝트를 만들어 시험한다

**주기적으로**
- [ ] PITR 보존 기간이 짧다면 주 1회 이상 §2 덤프
- [ ] 1년 넘은 덤프 폐기 (§3 — 보유기간 규칙이 백업에도 적용된다)

---

## 7. 이 문서에서 확인된 것과 확인이 필요한 것

**확인한 것**
- 스키마 테이블 13개 · 개인정보 테이블 2개(`members`·`newcomer_requests`)
- `newcomer_requests` 보유기간 1년 (`V1__init.sql:302` 주석 · `SPEC_API §8.6`)
- **1년 삭제 배치 미구현** (`grep`으로 `@Scheduled` 부재 확인)
- PM 로컬에 `pg_dump` 없음
- `ddl-auto: validate`이므로 스키마 불일치 시 기동 실패

**대시보드에서 확인해야 하는 것**
- **Neon Free의 PITR 보존 기간** — 이 문서의 §1 갈래를 결정하는 값이다
- Neon 브랜치로 복원 리허설이 가능한지
