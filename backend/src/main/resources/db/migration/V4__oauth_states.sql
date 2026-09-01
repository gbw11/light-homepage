-- ═══════════════════════════════════════════════════════════════════════
--  V4 — 카카오 로그인의 state (SPEC_API.md §2.7 · §2.8)
--
--  OAuth의 state는 원래 CSRF 방어값이다. 우리는 여기에 역할을 하나 더 준다 —
--  <가입 경로에서 registrationToken을 콜백까지 실어 나르는 것>.
--
--  ★ 그런데 registrationToken을 state에 **직접 넣지 않는다.** state는 카카오
--    인가 URL에 그대로 노출되는데(주소창·리퍼러·브라우저 기록), 그 토큰은
--    그것만 있으면 남의 이름으로 계정을 만들 수 있는 값이다.
--    그래서 서버가 무의미한 난수를 state로 발급하고, 이 표에서 되찾는다.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE oauth_states (
    id                    bigserial    PRIMARY KEY,

    -- ★ SHA-256. 평문 저장 금지 — 다른 토큰들과 같은 이유다.
    --   이 값을 아는 사람은 남의 콜백을 가로챌 수 있다.
    state_hash            varchar(255) NOT NULL,

    -- 가입 경로(§2.8 "신규 + 유효한 registrationToken")면 채워진다.
    -- 기존 카카오 가입자의 로그인이면 null이다.
    registration_token_id bigint,

    expires_at            timestamptz  NOT NULL,   -- 5분
    used_at               timestamptz,             -- 1회용
    created_at            timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT oauth_states_hash_uk UNIQUE (state_hash),

    -- 증표가 사라지면 이 state도 의미가 없다
    CONSTRAINT oauth_states_registration_fk FOREIGN KEY (registration_token_id)
        REFERENCES registration_tokens (id) ON DELETE CASCADE
);

CREATE INDEX oauth_states_expires_idx ON oauth_states (expires_at);

COMMENT ON TABLE  oauth_states IS '카카오 로그인 state (§2.7). CSRF 방어 + registrationToken 운반';
COMMENT ON COLUMN oauth_states.state_hash IS '★ 해시만 저장. 평문은 인가 URL에만 존재한다';
COMMENT ON COLUMN oauth_states.registration_token_id IS '가입 경로면 채워진다. 로그인 경로면 null';
