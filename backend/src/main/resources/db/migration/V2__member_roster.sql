-- ═══════════════════════════════════════════════════════════════════════
--  V2 — 교회 등록 명단 (member_roster)
--
--  근거: SPEC_API.md §2.1 (명단 대조 가입) · §8.2 (계정 삭제·명단 재개방)
--        · §13.3 (출결 대상은 계정이 아니라 명단)
--
--  ⚠️ 이 테이블은 "계정"이 아니라 "교회에 등록된 사람"이다. 계정을 한 번도
--     만들지 않은 교인도 여기 있고, 출석부는 그 사람들까지 체크한다.
--     members와 1:1이 아니다 — 명단 다수 : 계정 소수.
--
--  ⚠️ 명단 원본 CSV는 저장소에 커밋하지 않는다. 적재는 로컬에서만 한다
--     (RosterImportRunner, app.roster.import.*).
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE member_roster (
    id               bigserial    PRIMARY KEY,

    -- 동명이인 접미사를 포함한 이름. "김도연a"의 a까지가 이름이다.
    -- 떼지 않는다 — 저장·표시·대조 전부 이 값 그대로다 (SPEC_API §2.1).
    name             varchar(50)  NOT NULL,

    birth_date       date         NOT NULL,

    -- ★ 대조에 쓰는 값. 숫자만 남긴 형태로 저장한다.
    --   명단 CSV의 표기가 제각각이라("010-1234-5678", "01012345678",
    --   "+82 10 1234 5678") 원문끼리 비교하면 본인인데도 불일치가 난다.
    phone_normalized varchar(20)  NOT NULL,

    -- 사람이 읽고 거는 번호. §8.2에서 전도사가 본인 확인 전화를 걸 때 쓴다.
    -- 대조에는 쓰지 않는다 — 그건 위 phone_normalized의 몫이다.
    phone_display    varchar(30)  NOT NULL,

    -- 출석부(§13.3)가 쓴다. 인증에는 쓰이지 않는다.
    -- ⚠️ CHECK를 걸지 않는다. 값의 출처가 교회 명단 CSV이고 우리가 표기를
    --    통제하지 못한다 — 제약을 걸면 임포트가 통째로 막힌다.
    village          varchar(16),

    -- 전출·졸업 등으로 명단에서 빠진 사람. 삭제하지 않고 끈다.
    -- 지우면 출석 기록의 대상이 사라진다.
    active           boolean      NOT NULL DEFAULT true,

    -- ★ 이 행으로 계정을 만든 사람. null이면 "아직 미가입 = 가입 가능".
    --
    --   ⚠️ 가입 가능 여부의 판단 기준은 claimed_at이 아니라 **이 컬럼**이다.
    --      계정이 삭제되면 아래 ON DELETE SET NULL로 이 값이 저절로 null이
    --      되어 명단이 다시 열린다 (SPEC_API §8.2 선점 복구 · §2.12 탈퇴).
    --      애플리케이션이 해제를 잊어도 행이 영구히 잠기지 않는다 —
    --      잠기면 진짜 본인이 두 번 다시 가입할 수 없다.
    claimed_by       bigint,

    -- 언제 가입했는지의 기록용. 판단에 쓰지 않는다 (위 주석 참고).
    claimed_at       timestamptz,

    created_at       timestamptz  NOT NULL DEFAULT now(),
    updated_at       timestamptz  NOT NULL DEFAULT now(),

    -- ★ 같은 사람이 두 번 들어가는 것을 막는다. 이 제약이 없으면
    --   verify-roster가 2건을 만나 "임원에게 문의"로 빠지고, 그 사람은
    --   명단에 있는데도 가입할 수 없다 (SPEC_API §2.1).
    CONSTRAINT member_roster_person_uk UNIQUE (name, birth_date, phone_normalized),

    CONSTRAINT member_roster_claimed_by_fk FOREIGN KEY (claimed_by)
        REFERENCES members (id) ON DELETE SET NULL
);

-- 대조 조회는 (name, birth_date, phone_normalized) 세 값을 전부 쓴다 —
-- 위 UNIQUE 인덱스가 그대로 조회 인덱스가 된다. 따로 만들지 않는다.

-- 출석부가 "active 명단 전원"을 이름순으로 부른다 (SPEC_API §13.1 rosterCount).
CREATE INDEX member_roster_active_idx ON member_roster (name) WHERE active;

-- 회원 목록에서 계정 ↔ 명단을 되짚는다.
CREATE INDEX member_roster_claimed_idx ON member_roster (claimed_by)
    WHERE claimed_by IS NOT NULL;

COMMENT ON TABLE  member_roster IS '교회 등록 명단. 계정(members)과 별개이며 출결 대상이다';
COMMENT ON COLUMN member_roster.name IS '동명이인 접미사 포함 ("김도연a"). 접미사를 떼지 않는다';
COMMENT ON COLUMN member_roster.phone_normalized IS '★ 대조용. 숫자만 남긴 형태';
COMMENT ON COLUMN member_roster.claimed_by IS '★ 가입 가능 여부의 판단 기준. null이면 가입 가능';
