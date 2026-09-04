-- ═══════════════════════════════════════════════════════════════════════
--  V7 — 저장 용량·연산 횟수 회계 (COST_GUARDRAILS.md §3.6 · SPEC_API.md §8.5)
--
--  ⚠️ 2026-09-03에 R2에 결제 수단을 등록했다. 그전까지 1차 방어였던
--     "카드가 없으니 과금이 물리적으로 불가능하다"가 사라졌고, 이제
--     과금을 막는 것은 우리 코드뿐이다.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
--  §1. 월례회 페이지에 용량 컬럼을 붙인다
--
--  ★ 용량 집계에서 빠져 있었다. 저장 용량은 세 곳이 소비한다:
--
--      photos.size_bytes            사진첩          (V1에 있음)
--      attachments.size_bytes       게시물 첨부·주보 (V1에 있음 — 주보 페이지도
--                                                    attachments에 bulletin_id로
--                                                    매달린다)
--      meeting_doc_pages            월례회 문서      ← 컬럼이 없었다
--
--  월례회는 스캔 이미지 여러 장이라 무게가 가볍지 않다. 빠뜨리면
--  ARCHITECTURE.md §4.3이 경고한 "용량이 조용히 샌다"가 그대로 일어난다.
--  업로드는 M4지만 컬럼은 지금 만든다 — 회계를 짜는 지금이 아니면
--  이 누락을 다시 알아차릴 계기가 없다.
--
--  기존 행이 없으므로(월례회 업로드 미구현) DEFAULT 0으로 충분하다.
-- ───────────────────────────────────────────────────────────────────────
ALTER TABLE meeting_doc_pages
    ADD COLUMN size_bytes bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN meeting_doc_pages.size_bytes IS
    '용량 한도 계산의 근거 (SPEC_API §8.5). M4 업로드 구현 시 실측값을 채운다';


-- ───────────────────────────────────────────────────────────────────────
--  §2. R2 연산 횟수 (월별)
--
--  ★ 조사 결과 위험의 크기가 문서가 적어둔 것과 다르다:
--
--     - presigned URL "발급"은 과금되지 않는다. 서명은 우리 서버의 암호
--       연산이고 R2를 호출하지 않는다. 과금은 그 URL로 실제 요청이 갈 때다.
--     - 우리 동작 중 Class A는 **업로드(PutObject)뿐**이다. 사람이 사진을
--       올리는 행위라 월 100만 회는 사실상 도달하지 않는다.
--     - 조회(GetObject)는 Class B로 월 1,000만 회.
--     - 삭제(DeleteObject)는 **무료**다.
--
--    그래서 이 표는 "과금을 막는 장치"가 아니라 **버그 조기 발견 장치**다.
--    재시도 루프처럼 회원 수와 무관하게 호출이 늘어나는 사고를, 청구서가
--    아니라 우리 로그에서 먼저 보기 위한 것이다.
--
--  ⚠️ 실제 증가는 M3에서 R2 클라이언트를 붙일 때 연결된다. 그때까지
--     이 표는 비어 있다 — 세는 대상이 아직 없다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE r2_operation_counters (
    -- 'YYYY-MM'. 무료 한도가 달 단위로 초기화되므로 달마다 한 줄이다
    year_month varchar(7)  PRIMARY KEY,

    -- PutObject · CopyObject · ListObjects · 멀티파트 (월 100만 무료)
    class_a    bigint      NOT NULL DEFAULT 0,

    -- GetObject · HeadObject (월 1,000만 무료)
    class_b    bigint      NOT NULL DEFAULT 0,

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT r2_operation_counters_class_a_ck CHECK (class_a >= 0),
    CONSTRAINT r2_operation_counters_class_b_ck CHECK (class_b >= 0)
);

COMMENT ON TABLE  r2_operation_counters IS
    'R2 월별 연산 횟수. 과금 차단이 아니라 폭주 버그 조기 발견용 (COST_GUARDRAILS §3.6)';
COMMENT ON COLUMN r2_operation_counters.year_month IS '''YYYY-MM''. 무료 한도가 달 단위로 초기화된다';
COMMENT ON COLUMN r2_operation_counters.class_a IS 'PutObject 등 쓰기. 월 100만 무료';
COMMENT ON COLUMN r2_operation_counters.class_b IS 'GetObject 등 읽기. 월 1,000만 무료';
