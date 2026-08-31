# Jenkins + docker CLI — LIGHT 홈페이지 CI
#
# ⚠️ 왜 커스텀 이미지인가 (2026-08-31):
#   Jenkinsfile의 Backend 스테이지가 docker.image('postgres:16').withRun(...)으로
#   테스트용 Postgres를 띄우는데, 이 단계는 컨테이너 안에서 `docker` CLI를
#   실행한다. compose가 docker.sock을 마운트해도 공식 jenkins 이미지에는
#   CLI 바이너리가 없어서 모든 백엔드 빌드가 `docker: not found`(exit 127)로
#   죽는다. 컨테이너에 수동 설치하면 재생성 때 사라지므로 이미지에 굽는다.
#   → 상세 경위: README.md §6
FROM jenkins/jenkins:lts-jdk21

USER root

# docker CLI만 설치한다 (데몬은 호스트 것을 docker.sock으로 사용 — DooD)
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli \
 && rm -rf /var/lib/apt/lists/*

# compose가 user: root로 실행하므로 USER를 되돌리지 않아도 동작은 같지만,
# 이미지 단독 사용 시의 기본값은 원본과 동일하게 유지한다
USER jenkins
