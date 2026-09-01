-- ═══════════════════════════════════════════════════════════════════════
--  V3 — 인증 재설계 (SPEC_API.md §2 v1.3)
--
--  가입이 "이메일 + 전도사 승인"에서 "명단 대조 → 즉시 MEMBER"로 바뀐다.
--  근거: docs/spec/SPEC_API.md §2 · §8 · §10 (2026-08-31 v1.3)
--
--  ⚠️ 이 마이그레이션은 기존 계정을 지운다. 아래 §1의 이유를 읽을 것.
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
--  §1. 구모델 계정 정리
--
--  ⚠️ 여기서 members 행이 삭제된다.
--
--  v1.3 이전 계정은 이메일과 비밀번호만으로 만들어졌다 — 교회 명단과 대조된
--  적이 없다. 새 모델에서 계정은 "명단에서 확인된 사람"을 뜻하므로, 그 계정을
--  남겨두면 **명단 대조를 거치지 않은 계정이 살아 있는 상태**가 된다.
--  게다가 login_id가 없어 로그인할 수도 없다(이메일 로그인이 폐지된다).
--
--  즉 이 행들은 "쓸 수 없으면서 검증도 안 된" 상태다. 옮길 방법이 없다:
--    - login_id를 이메일에서 만들어내면 → 대조를 건너뛴 계정이 로그인 가능해진다
--    - 그대로 두면 → 아래 members_identity_ck를 위반해 마이그레이션이 실패한다
--
--  서비스가 아직 공개되지 않아 실사용 계정이 없다. 개발용 시드는 SeedRunner가
--  다시 만든다. members를 참조하는 FK는 전부 ON DELETE SET NULL 또는 CASCADE라
--  게시물·주보 같은 콘텐츠는 작성자만 null이 되고 남는다.
--
--  ★ 운영 데이터가 생긴 뒤에는 이 방식을 쓸 수 없다. 그때는 명단 대조를
--    거친 이관 절차가 따로 필요하다.
-- ───────────────────────────────────────────────────────────────────────
DELETE FROM members;


-- ───────────────────────────────────────────────────────────────────────
--  §2. 컬럼 교체
-- ───────────────────────────────────────────────────────────────────────

-- 사용자가 정한 아이디 (§9-A 확정). 카카오 전용 계정은 null이다.
ALTER TABLE members ADD COLUMN login_id varchar(30);

-- 어느 명단 행으로 가입했는지. ★ 계정 하나당 명단 한 행이다.
--   UNIQUE가 선점을 한 번 더 막는다 — member_roster.claimed_by와 서로를
--   가리키지만, 한쪽만 갱신되는 사고를 여기서 잡는다.
ALTER TABLE members ADD COLUMN roster_id bigint;

ALTER TABLE members
    ADD CONSTRAINT members_login_id_uk UNIQUE (login_id),
    ADD CONSTRAINT members_roster_uk   UNIQUE (roster_id),
    ADD CONSTRAINT members_roster_fk   FOREIGN KEY (roster_id)
        REFERENCES member_roster (id) ON DELETE SET NULL;

-- ★ 로그인 수단 CHECK를 email 컬럼보다 **먼저** 바꾼다.
--
--   ⚠️ members_identity_ck는 email을 참조한다. 컬럼을 먼저 지우면 Postgres가
--      그 제약을 **말없이 함께 지운다** — 그 뒤에 DROP CONSTRAINT를 하면
--      "constraint does not exist"로 마이그레이션이 통째로 실패한다.
--      (실제로 이 순서 때문에 한 번 깨졌다.)
ALTER TABLE members DROP CONSTRAINT members_identity_ck;

-- 이메일을 수집하지 않는다 (§2.6에서 제거 확정).
-- ⚠️ 비밀번호 재설정의 자력 수단이 사라진다 — 전도사가 리셋 코드를 발급하거나
--    (§8.4) 카카오로 로그인한다 (§2.7).
ALTER TABLE members DROP CONSTRAINT members_email_uk;
ALTER TABLE members DROP COLUMN email;

-- 마을은 가입에서 받지 않는다. 출석부(§13.3)가 쓰는 마을은 member_roster에 있다.
ALTER TABLE members DROP COLUMN village;

-- 승인 절차가 없다 (§9-B 확정 — 명단 대조가 본인 확인을 대신한다).
ALTER TABLE members DROP CONSTRAINT members_approved_by_fk;
ALTER TABLE members DROP COLUMN approved_at;
ALTER TABLE members DROP COLUMN approved_by;


-- ───────────────────────────────────────────────────────────────────────
--  §3. 제약 교체
-- ───────────────────────────────────────────────────────────────────────

-- 로그인 수단이 최소 하나는 있어야 한다. 이메일 자리를 login_id가 대신한다.
-- (옛 제약은 §2에서 이미 떨어뜨렸다 — 그 이유는 그쪽 주석 참고)
ALTER TABLE members
    ADD CONSTRAINT members_identity_ck
        CHECK (login_id IS NOT NULL OR kakao_id IS NOT NULL);

-- PENDING 소멸. 가입하면 즉시 MEMBER다.
ALTER TABLE members DROP CONSTRAINT members_role_ck;
ALTER TABLE members
    ADD CONSTRAINT members_role_ck CHECK (role IN ('MEMBER', 'LEADER', 'PASTOR'));

ALTER TABLE members ALTER COLUMN role SET DEFAULT 'MEMBER';

COMMENT ON COLUMN members.login_id IS '사용자가 정한 아이디. 카카오 전용 계정은 null';
COMMENT ON COLUMN members.roster_id IS '이 계정의 근거가 된 명단 행. 계정 하나당 한 행';
COMMENT ON COLUMN members.role IS 'MEMBER|LEADER|PASTOR — 계단식 상위 포함. PENDING은 v1.3에서 폐기';


-- ───────────────────────────────────────────────────────────────────────
--  §4. 가입 1단계 토큰 (SPEC_API §2.1 → §2.2)
--
--  명단 대조를 통과했다는 증표. 이것만 있으면 계정을 만들 수 있으므로
--  ★ 평문을 저장하지 않는다 — refresh_tokens·password_reset_tokens와 같다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE registration_tokens (
    id          bigserial    PRIMARY KEY,
    roster_id   bigint       NOT NULL,
    token_hash  varchar(255) NOT NULL,        -- ★ SHA-256. 평문 저장 금지
    expires_at  timestamptz  NOT NULL,        -- 5분 (§2.1)
    used_at     timestamptz,                  -- 1회용 (§2.1)
    created_at  timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT registration_tokens_hash_uk UNIQUE (token_hash),
    CONSTRAINT registration_tokens_roster_fk FOREIGN KEY (roster_id)
        REFERENCES member_roster (id) ON DELETE CASCADE
);

CREATE INDEX registration_tokens_roster_idx  ON registration_tokens (roster_id);
CREATE INDEX registration_tokens_expires_idx ON registration_tokens (expires_at);

COMMENT ON COLUMN registration_tokens.token_hash IS '★ 해시만 저장. 평문이 있으면 남의 계정을 만들 수 있다';


-- ───────────────────────────────────────────────────────────────────────
--  §5. 로그인 실패 잠금 (SPEC_API §2.3 — 5회 실패 → 15분)
--
--  ⚠️ 잠겼다는 사실을 응답으로 알려주지 않는다. 일반 실패와 같은 401이다
--     (§9-G 확정) — 구분해 주면 "이 아이디는 존재한다"가 새어나간다.
--
--  아이디 단위로 센다. IP 단위는 공용 와이파이(교회!)에서 한 사람의 실수가
--  전체를 잠그고, 반대로 IP를 바꿔가며 시도하면 무력해진다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE login_attempts (
    login_id      varchar(30)  PRIMARY KEY,
    failure_count int          NOT NULL DEFAULT 0,
    locked_until  timestamptz,
    updated_at    timestamptz  NOT NULL DEFAULT now()
);

COMMENT ON TABLE login_attempts IS '로그인 실패 잠금 (§2.3). 잠금 사실은 응답에 드러내지 않는다';
