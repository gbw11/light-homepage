# docs/ — 문서 지도

2026-08-28에 평평했던 21개 파일을 목적별 폴더로 정리했다. **파일명은 전부
그대로다** — "`SPEC_API §10`"처럼 경로 없이 파일명으로 인용하는 관행이 문서와
코드 주석 수백 곳에 있어서, 이름을 바꾸면 그 인용들이 전부 끊긴다.

| 폴더 | 무엇이 있나 | 언제 여는가 |
|---|---|---|
| [`spec/`](spec/) | PLAN · WORKPLAN · ARCHITECTURE · WIREFRAME · SPEC_API · SPEC_FUNCTIONAL · SPEC_NONFUNCTIONAL | **무엇을 만드는가** — 기획·화면·계약의 기준. 구현 전에 여기부터 |
| [`ops/`](ops/) | FLOW · CICD · TESTING · TOOLCHAIN · INTEGRATION · COST_GUARDRAILS | **어떻게 만들고 운영하는가** — 브랜치·CI·버전·비용 규칙 |
| [`backend/`](backend/) | BACKEND_TASKS · BACKEND_DEPLOY · ONBOARDING_BACKEND · BACKEND_HANDOFF | BE 협업 — 작업 지시서·배포·온보딩·FE→BE 인계 로그 |
| [`records/`](records/) | DECISIONS · DAILY_LOG · LIGHTHOUSE\_\* · PERF_SWEEP\_\* | 시간순 기록 — 결정·일지·측정 결과 |
| [`handoff/`](handoff/) | 날짜별 FE→BE 전달 브리핑 | 큰 제안·설계 전달 (요약 로그는 `backend/BACKEND_HANDOFF.md`) |
| [`handover/`](handover/) | 날짜별 작업 인계 | **하루를 시작할 때 최신 파일부터** |

### 방향이 반대일 때 — BE→FE 요청

위 `handoff/`와 `backend/BACKEND_HANDOFF.md`는 **FE→BE 방향 전용**이다. 반대로 BE가 FE에 요청하는 것은 **GitHub 이슈와 BE PR 본문**으로 온다. 그 회신은 반드시 **해당 이슈 댓글**로 남긴다 — 문서는 기록용 사본이지 전달 채널이 아니다. (2026-09-04 이슈 #169: 대응을 마치고도 문서에만 적어 BE는 미대응으로 알고 있었다.)

## 처음이라면 이 순서로

1. [`ops/FLOW.md`](ops/FLOW.md) — 브랜치를 파는 것부터 사용자 화면까지 전체 흐름 한 장
2. [`handover/`](handover/) 최신 파일 — 지금 어디까지 왔고 뭐가 막혀 있는지
3. [`spec/PLAN.md`](spec/PLAN.md) — 왜 이걸 만드는지

## 자주 찾는 것

| 찾는 것 | 위치 |
|---|---|
| API 계약 (엔드포인트·응답 형태) | [`spec/SPEC_API.md`](spec/SPEC_API.md) |
| 인가 매트릭스 (누가 뭘 볼 수 있나) | `spec/SPEC_API.md` §10 |
| PM 결정 이력 | [`records/DECISIONS.md`](records/DECISIONS.md) |
| CI가 왜 이렇게 생겼나 | [`ops/CICD.md`](ops/CICD.md) |
| 외부 서비스 추가 전 필독 | [`ops/COST_GUARDRAILS.md`](ops/COST_GUARDRAILS.md) |
| 프론트 작업 방식 | [`../frontend/docs/WORKFLOW.md`](../frontend/docs/WORKFLOW.md) (frontend 전용 문서는 `frontend/docs/`에 따로 있다) |
