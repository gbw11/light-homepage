-- ═══════════════════════════════════════════════════════════════════════
--  V12 — 앱 푸시 알림을 받을 기기 (2026-10-19, SPEC_API §15)
--
--  로그인한 앱이 자기 FCM 토큰을 등록한다. 회원 공지 · 새가족 신청 알림은
--  이 토큰들로만 보낸다 — 주제(topic)는 누구나 구독할 수 있어 회원 전용
--  알림을 실을 수 없다. 공개 알림(공개 공지 · 주보)은 주제로 보내 이 표를 쓰지 않는다.
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE member_devices (
    id          bigserial     PRIMARY KEY,
    -- 계정이 지워지면 기기도 함께 사라진다 — 지운 사람에게 알림이 가면 안 된다
    member_id   bigint        NOT NULL REFERENCES members (id) ON DELETE CASCADE,
    -- FCM 등록 토큰. 보통 160자 안팎이지만 길이를 약속하지 않으니 넉넉히
    token       varchar(4096) NOT NULL,
    platform    varchar(10)   NOT NULL,
    created_at  timestamptz   NOT NULL DEFAULT now(),
    -- 마지막으로 등록(갱신)한 때. 앱이 켤 때마다 다시 등록한다
    updated_at  timestamptz   NOT NULL DEFAULT now(),

    -- ★ 한 기기(토큰)는 한 사람의 것이다. 같은 폰에서 다른 사람이 로그인하면
    --   토큰의 주인을 옮긴다 — 앞 사람의 알림이 계속 가면 안 된다
    CONSTRAINT member_devices_token_uk   UNIQUE (token),
    CONSTRAINT member_devices_platform_ck CHECK (platform IN ('ANDROID', 'IOS'))
);

CREATE INDEX member_devices_member_idx ON member_devices (member_id);
