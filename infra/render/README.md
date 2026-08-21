# Render 배포 준비

Render Free에 백엔드를 Docker로 배포하는 설정. `backend/`가 아직
Spring 프로젝트로 초기화 전이라, 여기 있는 파일은 **템플릿**입니다.
백엔드가 지켜야 할 규약은 [`../../docs/BACKEND_DEPLOY.md`](../../docs/BACKEND_DEPLOY.md)에
정리돼 있습니다.

담당: PM/인프라 (`server_develop`). backend 초기화 후 반영은 백엔드 담당자와
같이 확인.

## 백엔드 프로젝트 생성 후 할 일

1. `infra/render/Dockerfile.backend.template` → `backend/Dockerfile`로 복사
2. Render 대시보드에서 New → Web Service → 이 저장소 연결
   - Runtime: **Docker**
   - Root Directory: `backend`
   - Dockerfile Path: `backend/Dockerfile`
   - Plan: **Free**
3. 환경 변수 등록 (`docs/ARCHITECTURE.md` §9 "백엔드(Render)" 목록 그대로)
4. Settings → **Auto-Deploy: Off** ★ 필수
   — 켜두면 Jenkins 테스트를 기다리지 않고 push 즉시 배포됨 (`docs/CICD.md` §5.2)
5. Settings → Deploy Hook URL 발급 → Jenkins credential `render-deploy-hook`로 등록
   (`infra/jenkins/README.md` §3, 아직 미등록 상태)
6. cron-job.org에 `/actuator/health` 10분 핑 등록 (콜드스타트 방지, `docs/ARCHITECTURE.md` §8.1)

## 로컬에서 이 Dockerfile로 미리 빌드/실행해보기

```bash
cd backend
docker build -f ../infra/render/Dockerfile.backend.template -t light-api-test .
docker run --rm -p 8080:8080 --env-file .env light-api-test
```

## 왜 지금 backend/Dockerfile을 만들지 않았는가

`backend/`는 백엔드 담당자 단독 소유 영역이라(`README.md` "각 담당자가
단독 소유"), Spring 프로젝트 자체가 없는 지금 그 안에 파일을 만들지
않았습니다. 대신 인프라가 소유하는 이 디렉터리에 템플릿만 두고, 실제
반영은 프로젝트 초기화 시점에 맞춰 진행합니다.
