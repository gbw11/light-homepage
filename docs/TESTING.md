# 테스트 가이드 — push했을 때 Jenkins/CI를 통과하려면

이 문서는 **"어떻게 테스트를 작성해야 Jenkinsfile의 검증 단계를 통과하는가"**에
대한 실무 가이드다. 설계 근거는 `ARCHITECTURE.md §5.3`, CI 정책은
`CICD.md §6`을 따른다 — 여기서는 중복 설명 없이 **실제로 손으로 하는 절차와
예시 코드**만 다룬다.

역할: PM(프론트엔드·인프라·기획 전체 담당)이 백엔드 담당자에게 요구사항을
전달할 때도 이 문서를 그대로 참조하면 된다.

---

## 1. 프론트엔드 — push 전 로컬 체크리스트

Jenkinsfile의 `Frontend` 스테이지는 아래 4개를 순서대로 실행한다. **로컬에서
먼저 이 순서로 돌려보고 전부 통과한 뒤 push**하면 Jenkins에서 실패할 일이
없다.

```bash
cd frontend
npm ci                              # devDependencies 포함 정확히 설치
npm run lint                        # ESLint
npm run type-check                  # next typegen && tsc --noEmit
NEXT_PUBLIC_USE_MOCK=1 npm run build # mock 모드 빌드 (백엔드 없이도 검증)
```

- 지금은 컴포넌트/단위 테스트가 CI에 포함돼 있지 않다(`CICD.md §6.2`). 즉
  **위 4개만 통과하면 CI는 통과**한다. 단위 테스트를 새로 도입하려면 Vitest +
  Testing Library를 추가하고 일정을 재산정해야 한다(`CICD.md §6.2` 참고) —
  지금 당장 필수는 아니다.
- Node 버전은 로컬·GitHub Actions·Jenkins가 전부 **22**로 통일돼 있다
  (`docs/TOOLCHAIN.md §1`). `nvm use` 또는 `.nvmrc`로 버전을 맞출 것.
- `.env.local`, `.env.production` 같은 실제 시크릿 파일은 절대 커밋하지 않는다
  (Jenkins Secret Scan이 차단함). `.env.example`/`.sample`/`.template`
  접미사 파일은 템플릿으로 취급되어 예외 처리되므로 안심하고 커밋 가능.

---

## 2. 백엔드 — 지금 상태와 반드시 채워야 할 테스트

**현재 `backend/`에는 코드가 없다** (README만 존재, `build.gradle`/`src` 없음).
즉 Jenkinsfile의 `Backend` 스테이지는 `expression { fileExists('backend/gradlew') }`
조건에 걸려 **아직 실행조차 되지 않는다.** 백엔드 담당자가 프로젝트를
부트스트랩하는 순간부터 아래 내용이 실제로 적용된다.

### 2.1 CI가 실행하는 순서 (Jenkinsfile 기준)

```bash
./gradlew compileJava compileTestJava --no-daemon
./gradlew test --tests "*Authorization*" --no-daemon   # ★ 인가 매트릭스 — 절대 스킵 금지
./gradlew build --no-daemon
```

테스트용 Postgres 16 컨테이너를 Jenkins가 자동으로 띄워주고
`DATABASE_URL`/`DB_USERNAME`/`DB_PASSWORD`/`JWT_SECRET`/`SPRING_PROFILES_ACTIVE=test`
를 환경변수로 주입한다 — 백엔드 담당자가 별도로 DB를 준비할 필요 없다.
단, `application-test.yml`에서 이 환경변수들을 읽도록 프로필을 구성해야 한다.

### 2.2 부트스트랩 시 반드시 넣어야 하는 의존성

`docs/TOOLCHAIN.md`가 명시한 테스트 스택: **JUnit 5 + MockMvc +
`spring-security-test`**. `build.gradle`에 아래가 빠지면 인가 매트릭스
테스트 자체를 작성할 수 없다.

```groovy
testImplementation 'org.springframework.boot:spring-boot-starter-test'
testImplementation 'org.springframework.security:spring-security-test'
```

### 2.3 인가 매트릭스 테스트 — CI에서 절대 스킵되지 않는 유일한 테스트

이 프로젝트는 **DB Row-Level Security가 없다** (`ARCHITECTURE.md §5.3`).
그래서 이 테스트가 사실상 유일한 최후 방어선이며, Jenkinsfile이 이름으로
필터링해서(`--tests "*Authorization*"`) 항상 실행한다. **클래스 이름에
`Authorization`이 들어가야 CI가 이 테스트를 찾는다.**

기본 골격 (`ARCHITECTURE.md §5.3` 표를 그대로 파라미터화):

```java
@SpringBootTest
@AutoConfigureMockMvc
class AuthorizationMatrixTest {

  @Autowired MockMvc mockMvc;

  @ParameterizedTest
  @MethodSource("authorizationMatrix")
  void 인가_매트릭스(String method, String path, Role role, int expectedStatus) throws Exception {
    mockMvc.perform(request(HttpMethod.valueOf(method), path)
            .with(role == null ? anonymous() : user(testUserOf(role))))
           .andExpect(status().is(expectedStatus));
  }

  static Stream<Arguments> authorizationMatrix() {
    return Stream.of(
      // method, path,                                   role,            expectedStatus
      arguments("GET", "/api/posts?category=NOTICE_PUBLIC", null,          200),
      arguments("GET", "/api/posts?category=NOTICE_MEMBER",  Role.PENDING, 403),
      arguments("GET", "/api/posts?category=MINUTES",        Role.MEMBER,  403),
      arguments("GET", "/api/posts/{예산안id}",               Role.MEMBER,  404), // 존재 자체를 숨김 — 403 아님!
      arguments("POST", "/api/posts",                        Role.LEADER,  200)
      // ... ARCHITECTURE.md §5.3 표의 모든 행을 여기에 추가
    );
  }
}
```

**지켜야 할 규칙** (`ARCHITECTURE.md §5.3`, `§5` 전체):
- 표에 있는 **모든 행**을 빠짐없이 커버해야 한다 — 표에 없는 보호 엔드포인트는
  미완성으로 간주.
- 권한 없는 리소스 접근은 **404를 반환**한다 (403이 아님) — 존재 자체를
  숨겨야 하는 리소스(예: 예산안 게시물)의 경우. 컨트롤러가 category 필터로
  걸러내는 방식이 아니라, **id로 조회 후 소유 category를 검사**하는 방식으로
  구현해야 이 규칙을 지킬 수 있다.
- 인가 검사는 **Controller + Service 이중 검사**로 한다 — Controller만 믿지
  않는다.
- 새 보호 엔드포인트를 추가하면 **이 테스트 표에도 행을 추가**해야 완료로
  인정된다 (`WORKPLAN.md`의 Definition of Done 기준).
- `§5.4` 자기잠금 방지 규칙(마지막 PASTOR는 강등/탈퇴 불가)도 별도 테스트로
  커버할 것.

### 2.4 그 외 CI 필수 테스트 (`CICD.md §6.1`)

| 테스트 | 우선도 |
|---|---|
| 인가 매트릭스 (`2.3`) | **최상 — 절대 스킵 금지** |
| 인증(JWT 발급·만료·위조) | 높음 |
| 서비스 단위 테스트 | 중간 |
| Flyway 마이그레이션 재현 (`backend/src/main/resources/db/migration/`) | 중간 — CI가 매번 처음부터 마이그레이션을 재생하므로, 로컬 DB에만 존재하는 수동 스키마 변경이 있으면 여기서 걸린다 |

---

## 3. 공통 — 실패했을 때

- `feat/*`에서 실패 → 그 브랜치에서 고쳐서 다시 push. **머지하지 않는다**
- `*_develop`/`develop`에서 실패 → 통합 브랜치가 깨진 상태이므로 즉시 수정
  커밋 + 상대에게 알림
- `main`에서 실패 → 배포가 중단된 상태. 롤백 여부를 협의

(`CICD.md §6.3` 그대로)
