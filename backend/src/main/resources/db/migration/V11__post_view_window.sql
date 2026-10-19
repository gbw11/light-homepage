-- ═══════════════════════════════════════════════════════════════════════
--  V11 — 회의록 · 예산안 열람 기간 (2026-10-19 결정, §3 [CONTRACT])
--
--  월례회 자료(§7)처럼 회의록(MINUTES)과 예산안(BUDGET)도 정한 기간에만 본다.
--  기간 밖에는 전도사(PASTOR)와 글쓴이만 연다 — 규칙은 PostQueryService에 있다.
-- ═══════════════════════════════════════════════════════════════════════

-- 공지에는 기간이 없다 — 그래서 NULL을 허용한다.
-- 회의록 · 예산안을 게시할 때 기간이 필수인 것은 API(§3.4)가 지킨다.
-- ⚠️ 이 마이그레이션 이전에 올라간 회의록 · 예산안은 기간이 NULL이고, NULL은
--    "열람 기간 아님"(잠김)으로 다룬다 (2026-10-19 결정). 전도사가 기간을 정해야 열린다.
ALTER TABLE posts ADD COLUMN viewable_from  timestamptz;
ALTER TABLE posts ADD COLUMN viewable_until timestamptz;

-- 둘 다 있거나 둘 다 없다. 있으면 끝이 시작보다 뒤다 (월례회 meeting_docs와 같은 규칙)
ALTER TABLE posts ADD CONSTRAINT posts_view_window_ck CHECK (
    (viewable_from IS NULL AND viewable_until IS NULL)
    OR (viewable_from IS NOT NULL AND viewable_until IS NOT NULL
        AND viewable_until > viewable_from)
);

COMMENT ON COLUMN posts.viewable_from IS
    '열람 시작 (회의록 · 예산안만). NULL이면 기간 없음 = 잠김. 공지는 늘 NULL';
COMMENT ON COLUMN posts.viewable_until IS
    '열람 종료 (회의록 · 예산안만). viewable_from과 함께 있거나 함께 없다';
