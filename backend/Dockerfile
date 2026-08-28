# ─────────────────────────────────────────────────────────────
#  LIGHT API — Render 배포용 이미지
#
#  소유: server_develop (인프라). `backend/` 안에 있지만 배포 설정이라
#        인프라가 관리한다 (INTEGRATION.md §6.3).
#        ⚠️ 백엔드 담당자가 여기를 고쳐야 할 일이 생기면 먼저 알려주세요 —
#        메모리 상한·포트는 프로젝트 전제라 임의로 바꿀 수 없습니다.
#
#  규약: docs/BACKEND_DEPLOY.md · 서비스 세팅: infra/render/README.md
#  전제: Render Free(메모리 512MB) · Java 21 · Gradle Wrapper 8.14.3
#
#  Render 설정: Root Directory `backend` / Dockerfile Path `Dockerfile`
#  → 빌드 컨텍스트가 `backend/`이므로 아래 COPY 경로는 전부 그 기준이다.
#  ⚠️ Dockerfile Path는 **Root Directory 기준**이다. `backend/Dockerfile`로
#     적으면 `backend/backend/Dockerfile`을 찾아 빌드가 즉시 실패한다
#     (2026-08-27에 실제로 겪었다 — infra/render/README.md §1②).
# ─────────────────────────────────────────────────────────────

# ── 1단계: 빌드 ──────────────────────────────────────────────
# ⚠️ `gradle:8-jdk21` 이미지가 아니라 **Wrapper**를 쓴다.
#    TOOLCHAIN.md §1이 "Gradle은 Wrapper 사용, 별도 설치 금지"로 못박았다.
#    이미지에 박힌 Gradle을 쓰면 로컬·CI(8.14.3)와 버전이 갈려서,
#    "내 컴퓨터에선 되는데 배포만 깨진다"가 생긴다.
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app

# 의존성 레이어를 먼저 굳힌다 — src만 바뀐 커밋에서는 이 단계가 캐시로 재사용된다.
# (Render Free는 빌드도 느리다. 이 한 겹이 재배포 시간을 크게 줄인다.)
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN chmod +x gradlew \
 && ./gradlew --no-daemon --quiet dependencies > /dev/null 2>&1 || true

COPY src src

# 테스트는 CI(GitHub Actions)에서 이미 돌았다. 여기서 다시 돌리지 않는다 —
# 배포 이미지 빌드가 테스트 실패로 깨지면 원인이 두 곳으로 갈린다.
RUN ./gradlew --no-daemon bootJar -x test \
 && find build/libs -name '*.jar' ! -name '*-plain.jar' -exec cp {} /app/app.jar \;
# ↑ 파일명을 version에 의존하지 않는다. `0.0.1-SNAPSHOT`이 올라가도 안 깨진다.

# ── 2단계: 실행 ──────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# ⚠️ 폰트를 왜 넣는가 — M4 월례회의 PDF→페이지 이미지 변환(PDFBox) 때문이다.
#    alpine JRE에는 fontconfig도 폰트도 없어서, AWT 폰트 코드가 처음 불릴 때
#    "Fontconfig head is null" 로 죽는다. 그 시점은 **배포된 서버에서 임원이
#    월례회 자료를 올리는 순간**이라 가장 늦게 발견된다.
#    (build.gradle에 pdfbox 3.0.3이 이미 들어와 있다.)
#    → M4에서 렌더링 품질 문제가 생기면 `eclipse-temurin:21-jre-jammy`(Debian)로
#      바꾸는 것이 다음 수단이다. 이미지가 커지는 대신 폰트 환경이 안정적이다.
#
#    ⚠️ **DejaVu에는 한글 글리프가 없다.** M4에서 한글 월례회 PDF를 렌더링하면
#       "죽지는 않지만 글자가 □□□로 나온다" — 죽는 것보다 발견이 늦다. M4 착수 시
#       한글 폰트(alpine community의 `font-nanum` 등)를 여기에 추가해야 한다.
#       ⚠️ 지금 넣지 않는 이유: 패키지명·저장소를 이미지 빌드로 확인해야 하는데
#       2026-08-27 시점에 로컬 Docker 데몬이 꺼져 있어 검증할 수 없었다. 검증 없이
#       `apk add`를 늘리면 **배포 빌드가 깨지고**, 그 대가가 이득보다 크다.
RUN apk add --no-cache fontconfig ttf-dejavu

# 루트로 돌리지 않는다 — 컨테이너가 뚫렸을 때 할 수 있는 일을 줄인다
RUN addgroup -S light && adduser -S light -G light
COPY --from=build --chown=light:light /app/app.jar app.jar
USER light

# ── JVM 옵션 — 콜드스타트와 512MB가 동시에 걸려 있다 ──────────
#
# `-Xms128m`: ★ 콜드스타트 단축. **-Xms를 주지 않으면 초기 힙이 8MB다**
#   (컨테이너 메모리의 1/64. young 영역은 2.6MB). 2026-08-27 로컬 실측:
#     java -XX:ActiveProcessorCount=1 -XX:MaxRAM=512m -Xmx400m -XX:+PrintFlagsFinal
#     → InitialHeapSize = 8388608
#   Spring Boot 기동은 그보다 훨씬 많이 할당한다. 8MB에서 시작하면 **기동하는 동안에만
#   힙 확장과 young GC를 수십 번 반복하고**, 0.1 CPU 인스턴스에서는 그 낭비가 그대로
#   새벽 첫 방문자의 대기 시간이 된다. 128m은 실측 총 사용량(299MB) 안이라 상한을
#   건드리지 않는다.
#
# `-Xmx400m`: Render Free 512MB 한도 (ARCHITECTURE.md §8.1).
#   ⚠️ 이 값은 프로젝트 전제다. 늘리려면 호스팅부터 다시 정해야 한다.
#   ⚠️ 그리고 이 값은 **여유가 없다.** 힙 400m + 힙 밖(메타스페이스·코드캐시·
#      스레드 스택) 약 180m이면 512MB를 넘는다. 즉 힙이 실제로 400m까지 차면
#      과금이 아니라 `Exited with status 137`(OOM)로 죽는다. 지금 안 죽는 이유는
#      힙을 그만큼 쓰지 않아서일 뿐이다. 그래서 스레드 수를 줄였다
#      (application.yml의 server.tomcat.threads — 스택이 스레드마다 붙는다).
#
# `-XX:+UseSerialGC`: ★ GC를 못 박는다. JVM은 **CPU 개수로 GC를 고른다** — 실측:
#     ActiveProcessorCount=1 → UseSerialGC=true (ergonomic)
#     ActiveProcessorCount=2 → UseG1GC=true    (ergonomic)
#   G1은 512MB·저CPU에서 손해다(힙 밖 보조 자료구조 + GC 스레드가 더 붙는다).
#   지금 Render Free(0.1 CPU)에서는 SerialGC가 이미 선택되므로 이 플래그는
#   사실상 현상 유지지만, **Render가 CPU 노출을 바꾸면 조용히 G1로 넘어간다.**
#   기본값에 의존하지 않고 우리 파일이 답을 갖게 한다 (alive 헬스 그룹과 같은 이유).
#
# `headless=true`: 서버에 디스플레이가 없다. PDFBox가 X11을 찾다 멈추지 않게 한다.
ENV JAVA_OPTS="-Xms128m -Xmx400m -XX:+UseSerialGC -Djava.awt.headless=true"

EXPOSE 8080

# ⚠️ `exec`가 있어야 java가 PID 1이 되어 SIGTERM을 직접 받는다.
#    없으면 재배포 때 sh가 신호를 삼켜서 컨테이너가 강제 종료되고,
#    처리 중이던 요청이 그대로 끊긴다.
#    ★ 이 줄이 `application.yml`의 `server.shutdown: graceful`의 **전제**다 —
#      SIGTERM이 java에 닿지 않으면 graceful shutdown은 한 번도 실행되지 않는다.
#      둘 중 하나만 있으면 아무 효과가 없으므로 같이 본다.
# ⚠️ `${PORT:-8080}`: Render는 PORT 환경변수로 수신 포트를 지정한다.
#    application.yml의 8080 고정은 로컬 기준이므로, 배포에서는 이쪽이 이긴다.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]
