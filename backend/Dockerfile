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
RUN apk add --no-cache fontconfig ttf-dejavu

# 루트로 돌리지 않는다 — 컨테이너가 뚫렸을 때 할 수 있는 일을 줄인다
RUN addgroup -S light && adduser -S light -G light
COPY --from=build --chown=light:light /app/app.jar app.jar
USER light

# `-Xmx400m`: Render Free 512MB 한도 (ARCHITECTURE.md §8.1).
#   ⚠️ 이 값은 프로젝트 전제다. 늘리려면 호스팅부터 다시 정해야 한다.
# `headless=true`: 서버에 디스플레이가 없다. PDFBox가 X11을 찾다 멈추지 않게 한다.
ENV JAVA_OPTS="-Xmx400m -Djava.awt.headless=true"

EXPOSE 8080

# ⚠️ `exec`가 있어야 java가 PID 1이 되어 SIGTERM을 직접 받는다.
#    없으면 재배포 때 sh가 신호를 삼켜서 컨테이너가 강제 종료되고,
#    처리 중이던 요청이 그대로 끊긴다.
# ⚠️ `${PORT:-8080}`: Render는 PORT 환경변수로 수신 포트를 지정한다.
#    application.yml의 8080 고정은 로컬 기준이므로, 배포에서는 이쪽이 이긴다.
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -Dserver.port=${PORT:-8080} -jar app.jar"]
