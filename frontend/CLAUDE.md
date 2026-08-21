@AGENTS.md

# 프론트엔드 작업 가이드 — 여기서 시작

이 저장소의 프론트엔드 작업은 전부 **하네스 엔지니어링 방식**(작업을 작은
단위로 쪼개고, 단위마다 검증을 통과시키는 루프)으로 진행한다. 아래 문서를
상황에 맞게 읽는다 — 이 파일 자체는 안내 역할만 하고 규칙은 담지 않는다.

| 문서 | 언제 읽는가 |
|---|---|
| [`docs/HARNESS.md`](docs/HARNESS.md) | **가장 먼저** — 이게 에이전트 판단이 필요한 일인지, 지금 자율성 단계가 뭔지, "됐다"를 뭘로 증명하는지 |
| [`docs/WORKFLOW.md`](docs/WORKFLOW.md) | **작업 시작 전 매번** — 작업을 어떻게 쪼개고 검증하고, 문맥을 뭘 참고하고, 언제 멈추는지 |
| [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) | 승인 없이 해도 되는지 애매할 때 |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | 코드 작성 전 — 폴더 구조·API 계층·상태관리·타입 규칙 |
| [`docs/COMPONENTS.md`](docs/COMPONENTS.md) | 컴포넌트를 만들거나 쪼갤 때 |
| [`docs/OBSERVABILITY.md`](docs/OBSERVABILITY.md) | 실패했을 때, 또는 재발 방지를 기록할 때 |
| [`../docs/TESTING.md`](../docs/TESTING.md) | push 전 — CI(Jenkins/Actions) 통과 체크리스트 |
| [`../docs/SPEC_FUNCTIONAL.md`](../docs/SPEC_FUNCTIONAL.md) | 기능 구현 시 — 기능 명세 |
| [`../docs/WIREFRAME.md`](../docs/WIREFRAME.md) | 화면 구현 시 — 와이어프레임 |
| [`../docs/SPEC_API.md`](../docs/SPEC_API.md) | API 연동 시 — 백엔드 계약 |
| [`../docs/INTEGRATION.md`](../docs/INTEGRATION.md) | PR 올리기 전 — 브랜치/협업 규칙 |
| [`../docs/DECISIONS.md`](../docs/DECISIONS.md) | **PM이 새 결정을 말할 때마다 자동 기록** — 요청받지 않아도 항상 (`HARNESS.md` §1.1) |
| [`../docs/BACKEND_HANDOFF.md`](../docs/BACKEND_HANDOFF.md) | **백엔드가 알아야 할 내용이 생길 때마다 자동 기록** — 요청받지 않아도 항상 (`WORKFLOW.md` §7) |
