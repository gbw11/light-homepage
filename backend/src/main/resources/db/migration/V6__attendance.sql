-- ═══════════════════════════════════════════════════════════════════════
--  V6 — 출석부 (SPEC_API.md §13)
--
--  ⚠️ 출결 대상은 계정(members)이 아니라 **명단(member_roster)**이다.
--     계정을 만들지 않은 교인도 체크한다 (§13 머리말).
--
--  ⚠️ 출석 기록은 "누가 교회에 안 나왔는지"의 기록이다 — 예산안과 같은 급의
--     민감 정보로 다룬다 (§13.0). 열람은 전부 L(임원) 이상이다.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
--  §1. 회차
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE attendance_sessions (
    id           bigserial    PRIMARY KEY,

    -- ★ 컬럼명을 date로 두지 않는다 — SQL 예약어라 인용부호 없이는 쓸 수 없다.
    --   응답 필드명은 계약대로 date다 (§13.1).
    session_date date         NOT NULL,

    -- SUNDAY_SERVICE | ETC (§13.1 — 값 목록은 BE 합의 대상이었고 이 둘로 확정)
    type         varchar(20)  NOT NULL,

    title        varchar(100) NOT NULL,

    -- 누가 회차를 만들었는지. 만든 사람이 탈퇴하면 null로 남는다
    created_by   bigint,
    created_at   timestamptz  NOT NULL DEFAULT now(),

    -- ★ 같은 날짜 + 같은 종류는 하나만 (§13.2 DUPLICATE).
    --   실수로 회차가 둘 생기면 출결이 갈라져 "누가 체크했는지"를 알 수 없게 된다.
    CONSTRAINT attendance_sessions_date_type_uk UNIQUE (session_date, type),

    CONSTRAINT attendance_sessions_type_ck CHECK (type IN ('SUNDAY_SERVICE', 'ETC')),

    CONSTRAINT attendance_sessions_created_by_fk FOREIGN KEY (created_by)
        REFERENCES members (id) ON DELETE SET NULL
);

CREATE INDEX attendance_sessions_date_idx ON attendance_sessions (session_date DESC);

COMMENT ON TABLE  attendance_sessions IS '출석 회차 (SPEC_API §13.1). 같은 날짜+종류는 하나뿐';
COMMENT ON COLUMN attendance_sessions.session_date IS '회차 날짜. 응답 필드명은 date다 (§13.1)';


-- ───────────────────────────────────────────────────────────────────────
--  §2. 출결 기록
--
--  ★ "기록 없음"을 status로 표현하지 않는다 — **행이 없는 것**으로 표현한다.
--
--    §13.0이 "null(기록 없음)은 ABSENT와 다르다"고 못 박고 있다. status에
--    null을 허용하면 <행은 있는데 status가 null인 상태>와 <행이 없는 상태>가
--    둘 다 "기록 없음"을 뜻하게 되어, 집계(checkedCount)가 무엇을 세야 하는지
--    모호해진다. 행의 존재 = 체크됨으로 두면 그 모호함이 사라진다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE attendance_entries (
    id         bigserial   PRIMARY KEY,

    session_id bigint      NOT NULL,
    roster_id  bigint      NOT NULL,

    -- PRESENT | LATE | ABSENT | EXCUSED (§13.0). null은 없다 — 위 주석 참고
    status     varchar(16) NOT NULL,

    -- 누가 마지막으로 체크했는지. 두 임원이 나눠 체크하는 것이 정상 흐름이다
    updated_by bigint,
    updated_at timestamptz NOT NULL DEFAULT now(),

    -- ★ upsert의 키 (§13.4). 한 회차에서 한 사람은 한 줄이다
    CONSTRAINT attendance_entries_uk UNIQUE (session_id, roster_id),

    CONSTRAINT attendance_entries_status_ck CHECK (status IN
        ('PRESENT', 'LATE', 'ABSENT', 'EXCUSED')),

    -- 회차를 지우면 출결도 함께 사라진다 (§13.5)
    CONSTRAINT attendance_entries_session_fk FOREIGN KEY (session_id)
        REFERENCES attendance_sessions (id) ON DELETE CASCADE,

    -- 명단 행이 사라지면 그 사람의 출결도 의미가 없다
    CONSTRAINT attendance_entries_roster_fk FOREIGN KEY (roster_id)
        REFERENCES member_roster (id) ON DELETE CASCADE,

    CONSTRAINT attendance_entries_updated_by_fk FOREIGN KEY (updated_by)
        REFERENCES members (id) ON DELETE SET NULL
);

CREATE INDEX attendance_entries_session_idx ON attendance_entries (session_id);
CREATE INDEX attendance_entries_roster_idx  ON attendance_entries (roster_id);

COMMENT ON TABLE  attendance_entries IS '출결 기록 (SPEC_API §13.3·§13.4). 행이 없으면 "기록 없음"';
COMMENT ON COLUMN attendance_entries.status IS 'PRESENT|LATE|ABSENT|EXCUSED. ★ null은 없다 — 기록 없음은 행의 부재로 표현한다';
