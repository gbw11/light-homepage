# Flutter 검증 이미지 — Jenkinsfile의 Mobile 스테이지가 이 안에서 analyze·test를 돌린다.
#
# ⚠️ 왜 직접 만드나 (2026-10-07):
#   흔히 쓰는 ghcr.io/cirruslabs/flutter는 3.44까지만 있고, 프로젝트는 3.47.6이다
#   (mobile/.metadata revision 5fc3468). 버전이 다르면 Jenkins에서만 analyze
#   결과가 달라져 원인 추적에 시간이 든다 (docs/ops/TOOLCHAIN.md §0).
#
#   Android SDK는 넣지 않는다 — APK 빌드는 GitHub Actions(mobile-ci.yml)만 한다.
#   그래서 이미지가 작고(SDK 포함 시 수 GB), 첫 빌드 후에는 레이어 캐시로 즉시 뜬다.
#
# 버전을 올릴 때: FLUTTER_VERSION·FLUTTER_SHA256을 releases_linux.json에서 함께 바꾸고,
#   Jenkinsfile의 FLUTTER_IMAGE 태그 · mobile-ci.yml · TOOLCHAIN.md도 같이 바꾼다.
#   https://storage.googleapis.com/flutter_infra_release/releases/releases_linux.json
FROM debian:bookworm-slim

ARG FLUTTER_VERSION=3.47.6
ARG FLUTTER_SHA256=f1631b9c2c8b3529323db412b0d1beacf4a748f8783b0d7cf599a8fd5f461675

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*

ENV PATH="/opt/flutter/bin:/opt/flutter/bin/cache/dart-sdk/bin:${PATH}"     FLUTTER_SUPPRESS_ANALYTICS=true     PUB_CACHE=/opt/pub-cache

# ⚠️ 한 레이어로 묶는다 — chmod -R을 따로 RUN하면 SDK 전체가 레이어에 한 번 더
#    복사돼 이미지가 두 배(약 5GB)가 된다. 엔진·Dart 아티팩트도 여기서 미리 받는다.
RUN curl -fsSL -o /tmp/flutter.tar.xz       "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_${FLUTTER_VERSION}-stable.tar.xz"  && echo "${FLUTTER_SHA256}  /tmp/flutter.tar.xz" | sha256sum -c -  && tar -xJf /tmp/flutter.tar.xz -C /opt  && rm /tmp/flutter.tar.xz  && git config --system --add safe.directory '*'  && flutter config --no-analytics --no-cli-animations  && flutter precache --no-android --no-ios --no-web --no-linux  && dart --disable-analytics  && mkdir -p /opt/pub-cache  && chmod -R a+rwX /opt/flutter /opt/pub-cache
