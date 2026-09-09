-- ═══════════════════════════════════════════════════════════════════════
--  V8 — 첨부에 이미지 크기 (SPEC_API.md §5.1)
--
--  주보 상세의 pages[]가 width·height를 요구한다. 뷰어가 이미지를 받기
--  **전에** 자리를 잡아야 하기 때문이다 — 없으면 로딩 중 화면이 튄다.
--
--  주보 페이지는 별도 테이블이 아니라 attachments에 bulletin_id로 매달린다
--  (V1 스키마). 그래서 컬럼이 여기 붙는다.
--
--  게시물 첨부(pdf·hwp 등)에는 의미가 없으므로 nullable이다.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE attachments
    ADD COLUMN width  int,
    ADD COLUMN height int;

COMMENT ON COLUMN attachments.width IS
    '이미지인 경우의 가로 픽셀 (SPEC_API §5.1 pages[].width). 그 외 null';
COMMENT ON COLUMN attachments.height IS
    '이미지인 경우의 세로 픽셀. 뷰어가 받기 전에 자리를 잡는 데 쓴다';
