-- ═══════════════════════════════════════════════════════════════════════
--  V1 — 전체 스키마
--
--  근거: ARCHITECTURE.md §3 · BACKEND_TASKS.md §4
--  나중에 테이블을 하나씩 추가하는 것보다 M1에 한 번에 만드는 편이 낫다는
--  판단에 따라 M4까지 쓰는 테이블을 전부 여기서 만든다.
--
--  ⚠️ 이 파일은 머지된 뒤에는 절대 수정하지 않는다. Flyway가 체크섬을
--     저장해두므로 내용이 바뀌면 다음 실행에서 실패한다. 변경은 V2로.
--
--  ⚠️ 이 프로젝트에는 RLS(행 수준 권한)가 없다. 아래 CHECK 제약은
--     권한 방어선이 아니라 값 무결성 장치일 뿐이다. 권한은 전부
--     애플리케이션이 책임진다 (ARCHITECTURE.md §5.2).
-- ═══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────
--  회원
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE members (
    id            bigserial    PRIMARY KEY,
    email         varchar(255),                 -- 카카오 전용 계정은 null
    password_hash varchar(255),                 -- BCrypt. 카카오 전용은 null
    kakao_id      varchar(64),                  -- 카카오 식별자
    name          varchar(50)  NOT NULL,        -- 실명 (승인 대조용)
    phone         varchar(20),
    village       varchar(16),                  -- '1'~'9' | 'newcomer'
    role          varchar(16)  NOT NULL DEFAULT 'PENDING',
    approved_at   timestamptz,
    approved_by   bigint,
    created_at    timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT members_email_uk    UNIQUE (email),
    CONSTRAINT members_kakao_id_uk UNIQUE (kakao_id),

    -- 카카오 비즈 앱 전환 전에는 이메일을 못 받는다. 그래서 email은
    -- nullable이고 kakao_id로 식별한다 (BACKEND_TASKS.md §11).
    -- 다만 둘 다 없으면 로그인할 방법이 없으므로 최소 하나는 요구한다.
    CONSTRAINT members_identity_ck CHECK (email IS NOT NULL OR kakao_id IS NOT NULL),

    CONSTRAINT members_role_ck     CHECK (role IN ('PENDING', 'MEMBER', 'LEADER', 'PASTOR')),
    CONSTRAINT members_village_ck  CHECK (village IS NULL OR village IN
                                         ('1','2','3','4','5','6','7','8','9','newcomer')),

    CONSTRAINT members_approved_by_fk FOREIGN KEY (approved_by)
        REFERENCES members (id) ON DELETE SET NULL
);

-- 관리 화면이 status=PENDING으로 거르고 이름으로 검색한다 (SPEC_API.md §8.1)
CREATE INDEX members_role_idx ON members (role);
CREATE INDEX members_name_idx ON members (name);

COMMENT ON COLUMN members.name IS '실명. 카카오 닉네임이 아니라 앱에서 직접 받는다 (승인 대조용)';
COMMENT ON COLUMN members.role IS 'PENDING|MEMBER|LEADER|PASTOR — 계단식 상위 포함';


-- ───────────────────────────────────────────────────────────────────────
--  리프레시 토큰
--  ★ 평문을 저장하지 않는다. DB가 유출되어도 토큰을 그대로 쓸 수 없어야 한다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE refresh_tokens (
    id         bigserial    PRIMARY KEY,
    member_id  bigint       NOT NULL,
    token_hash varchar(255) NOT NULL,
    expires_at timestamptz  NOT NULL,
    revoked_at timestamptz,
    created_at timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT refresh_tokens_hash_uk  UNIQUE (token_hash),
    CONSTRAINT refresh_tokens_member_fk FOREIGN KEY (member_id)
        REFERENCES members (id) ON DELETE CASCADE
);

CREATE INDEX refresh_tokens_member_idx  ON refresh_tokens (member_id);
CREATE INDEX refresh_tokens_expires_idx ON refresh_tokens (expires_at);

COMMENT ON COLUMN refresh_tokens.token_hash IS '★ 해시만 저장. 평문 저장 금지';


-- ───────────────────────────────────────────────────────────────────────
--  비밀번호 재설정 토큰
--  ⚠️ ARCHITECTURE.md §3 데이터 모델에는 없는 테이블이다. 다만
--     SPEC_API.md §2.9·§2.10의 "1회용·만료" 재설정 토큰을 담을 곳이
--     필요하고, "스키마는 M1에 한 번에 만든다"는 방침에 맞춰 지금 만든다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE password_reset_tokens (
    id         bigserial    PRIMARY KEY,
    member_id  bigint       NOT NULL,
    token_hash varchar(255) NOT NULL,
    expires_at timestamptz  NOT NULL,
    used_at    timestamptz,                     -- 1회용: 사용 즉시 기록
    created_at timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT password_reset_tokens_hash_uk   UNIQUE (token_hash),
    CONSTRAINT password_reset_tokens_member_fk FOREIGN KEY (member_id)
        REFERENCES members (id) ON DELETE CASCADE
);

CREATE INDEX password_reset_tokens_member_idx ON password_reset_tokens (member_id);


-- ───────────────────────────────────────────────────────────────────────
--  게시물 — 공지 · 회의록 · 예산안 통합
--
--  ⚠️ 한 테이블에 합쳤으므로 조회에서 category 권한 검사를 빠뜨리면
--     예산안·회의록이 한 번에 전부 새어나간다. PostQueryService의
--     단일 관문을 반드시 통과시킬 것 (ARCHITECTURE.md §5.2).
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE posts (
    id           bigserial    PRIMARY KEY,
    category     varchar(20)  NOT NULL,
    title        varchar(200) NOT NULL,
    slug         varchar(200),                  -- 공개 공지만 사용
    body         text         NOT NULL,         -- 리치텍스트 JSON (Tiptap)
    pinned       boolean      NOT NULL DEFAULT false,
    author_id    bigint,
    published_at timestamptz,                   -- null이면 임시저장
    created_at   timestamptz  NOT NULL DEFAULT now(),
    updated_at   timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT posts_slug_uk    UNIQUE (slug),
    CONSTRAINT posts_category_ck CHECK (category IN
        ('NOTICE_PUBLIC', 'NOTICE_MEMBER', 'MINUTES', 'BUDGET')),
    CONSTRAINT posts_author_fk  FOREIGN KEY (author_id)
        REFERENCES members (id) ON DELETE SET NULL
);

-- 목록 정렬은 pinned 우선 → publishedAt 최신순 (SPEC_API.md §3.2)
CREATE INDEX posts_list_idx ON posts (category, pinned DESC, published_at DESC);

COMMENT ON COLUMN posts.category IS 'NOTICE_PUBLIC|NOTICE_MEMBER|MINUTES|BUDGET — 열람 권한이 이 값으로 갈린다';
COMMENT ON COLUMN posts.published_at IS 'null이면 임시저장 (SPEC_API.md §3.4 publish:false)';


-- ───────────────────────────────────────────────────────────────────────
--  주보
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE bulletins (
    id           bigserial   PRIMARY KEY,
    service_date date        NOT NULL,
    uploaded_by  bigint,
    created_at   timestamptz NOT NULL DEFAULT now(),

    -- 같은 날짜로 다시 올리면 DUPLICATE (SPEC_API.md §5.4)
    CONSTRAINT bulletins_service_date_uk UNIQUE (service_date),
    CONSTRAINT bulletins_uploaded_by_fk  FOREIGN KEY (uploaded_by)
        REFERENCES members (id) ON DELETE SET NULL
);


-- ───────────────────────────────────────────────────────────────────────
--  첨부파일 — posts · bulletins 공용
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE attachments (
    id           bigserial    PRIMARY KEY,
    post_id      bigint,
    bulletin_id  bigint,
    r2_key       varchar(500) NOT NULL,
    r2_key_thumb varchar(500),                  -- 이미지(주보)인 경우
    filename     varchar(255) NOT NULL,
    content_type varchar(100),
    size_bytes   bigint       NOT NULL,
    sort_order   int          NOT NULL DEFAULT 0,   -- 주보 페이지 순서
    created_at   timestamptz  NOT NULL DEFAULT now(),

    -- 업로드 직후에는 아직 어디에도 연결되지 않은 상태다(둘 다 null).
    -- 게시물 저장 시 attachmentIds로 연결되고, 연결되지 않은 첨부는
    -- 24시간 후 정리된다 (SPEC_API.md §4.1).
    -- 다만 게시물과 주보에 동시에 매달리는 것은 허용하지 않는다.
    CONSTRAINT attachments_owner_ck CHECK (NOT (post_id IS NOT NULL AND bulletin_id IS NOT NULL)),

    CONSTRAINT attachments_post_fk     FOREIGN KEY (post_id)
        REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT attachments_bulletin_fk FOREIGN KEY (bulletin_id)
        REFERENCES bulletins (id) ON DELETE CASCADE
);

CREATE INDEX attachments_post_idx     ON attachments (post_id);
CREATE INDEX attachments_bulletin_idx ON attachments (bulletin_id, sort_order);
-- 미연결 첨부 정리 배치가 훑는 경로
CREATE INDEX attachments_orphan_idx   ON attachments (created_at)
    WHERE post_id IS NULL AND bulletin_id IS NULL;


-- ───────────────────────────────────────────────────────────────────────
--  사진 앨범
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE albums (
    id             bigserial    PRIMARY KEY,
    title          varchar(200) NOT NULL,
    event_date     date,
    cover_photo_id bigint,                      -- FK는 photos 생성 후 아래에서 추가
    created_by     bigint,
    created_at     timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT albums_created_by_fk FOREIGN KEY (created_by)
        REFERENCES members (id) ON DELETE SET NULL
);


-- ───────────────────────────────────────────────────────────────────────
--  사진 — 파일 본체는 R2에 있고 여기에는 메타데이터만 둔다
--
--  ⚠️ size_bytes 합계로 용량 한도를 계산한다(80% 경고 · 95% 업로드 차단).
--     R2 API로 매번 실측하면 요청 한도를 낭비한다 (ARCHITECTURE.md §3.2).
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE photos (
    id           bigserial    PRIMARY KEY,
    album_id     bigint       NOT NULL,
    r2_key_view  varchar(500) NOT NULL,         -- 2560px, 확대·다운로드용
    r2_key_thumb varchar(500) NOT NULL,         -- 640px, 그리드용
    width        int,
    height       int,
    size_bytes   bigint       NOT NULL DEFAULT 0,   -- view+thumb 합계
    taken_at     timestamptz,
    sort_order   int          NOT NULL DEFAULT 0,
    status       varchar(16)  NOT NULL DEFAULT 'PENDING',
    created_at   timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT photos_status_ck CHECK (status IN ('PENDING', 'COMMITTED')),
    CONSTRAINT photos_album_fk  FOREIGN KEY (album_id)
        REFERENCES albums (id) ON DELETE CASCADE
);

-- 커서 페이징: 앨범 안에서 id 기준으로 훑는다 (SPEC_API.md §6.4)
CREATE INDEX photos_cursor_idx ON photos (album_id, id);
-- 미커밋(PENDING) 24시간 경과 행을 찾는 정리 배치용
CREATE INDEX photos_pending_idx ON photos (created_at) WHERE status = 'PENDING';

COMMENT ON COLUMN photos.size_bytes IS 'view+thumb 합계. 용량 한도 계산의 근거';
COMMENT ON COLUMN photos.status IS 'PENDING=URL만 발급된 상태 · COMMITTED=R2 업로드 확정';

-- albums ↔ photos 순환 참조라 photos 생성 뒤에 건다.
-- 대표 사진이 지워져도 앨범은 남아야 하므로 SET NULL.
ALTER TABLE albums
    ADD CONSTRAINT albums_cover_photo_fk FOREIGN KEY (cover_photo_id)
        REFERENCES photos (id) ON DELETE SET NULL;


-- ───────────────────────────────────────────────────────────────────────
--  월례회 자료
--  ★ 원본(Word/PDF)은 저장하지 않는다. 남으면 그 자체가 유출 경로다.
--    페이지 이미지만 보관하고, 열람은 서버가 워터마크를 합성해 스트리밍한다.
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE meeting_docs (
    id             bigserial    PRIMARY KEY,
    title          varchar(200) NOT NULL,
    meeting_date   date         NOT NULL,
    viewable_from  timestamptz  NOT NULL,
    viewable_until timestamptz  NOT NULL,       -- ★ 이후 MEMBER는 열람 불가
    page_count     int          NOT NULL,
    created_by     bigint,
    created_at     timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT meeting_docs_window_ck  CHECK (viewable_until > viewable_from),
    CONSTRAINT meeting_docs_created_by_fk FOREIGN KEY (created_by)
        REFERENCES members (id) ON DELETE SET NULL
);

CREATE INDEX meeting_docs_date_idx ON meeting_docs (meeting_date DESC);


CREATE TABLE meeting_doc_pages (
    id      bigserial    PRIMARY KEY,
    doc_id  bigint       NOT NULL,
    page_no int          NOT NULL,
    r2_key  varchar(500) NOT NULL,              -- ★ 절대 클라이언트에 노출 금지
    width   int,
    height  int,

    CONSTRAINT meeting_doc_pages_uk     UNIQUE (doc_id, page_no),
    CONSTRAINT meeting_doc_pages_doc_fk FOREIGN KEY (doc_id)
        REFERENCES meeting_docs (id) ON DELETE CASCADE
);

COMMENT ON COLUMN meeting_doc_pages.r2_key IS
    '★ 응답에 절대 포함하지 않는다. presigned URL도 발급하지 않는다 (SPEC_API.md §7.3)';


-- 열람 로그 — 유출 시 워터마크와 대조하는 근거
CREATE TABLE meeting_doc_views (
    id         bigserial   PRIMARY KEY,
    doc_id     bigint      NOT NULL,
    member_id  bigint      NOT NULL,
    page_no    int         NOT NULL,
    viewed_at  timestamptz NOT NULL DEFAULT now(),
    ip         varchar(45),                     -- IPv6 최대 45자
    user_agent varchar(300),

    CONSTRAINT meeting_doc_views_doc_fk    FOREIGN KEY (doc_id)
        REFERENCES meeting_docs (id) ON DELETE CASCADE,
    CONSTRAINT meeting_doc_views_member_fk FOREIGN KEY (member_id)
        REFERENCES members (id) ON DELETE CASCADE
);

-- 열람자 집계 (SPEC_API.md §7.7)
CREATE INDEX meeting_doc_views_doc_member_idx ON meeting_doc_views (doc_id, member_id);


-- ───────────────────────────────────────────────────────────────────────
--  새가족 등록 (공개 폼)
--  ⚠️ 개인정보. 보유기간 1년 후 삭제한다 (SPEC_API.md §8.6).
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE newcomer_requests (
    id         bigserial   PRIMARY KEY,
    name       varchar(50) NOT NULL,
    phone      varchar(20) NOT NULL,
    gender     varchar(10),
    age_group  varchar(20),
    referrer   varchar(20),
    message    text,
    agreed_at  timestamptz NOT NULL,            -- 개인정보 동의 시각
    created_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT newcomer_gender_ck    CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE')),
    CONSTRAINT newcomer_age_group_ck CHECK (age_group IS NULL OR age_group IN
        ('EARLY_20S', 'LATE_20S', 'EARLY_30S', 'LATE_30S')),
    CONSTRAINT newcomer_referrer_ck  CHECK (referrer IS NULL OR referrer IN
        ('FRIEND', 'SEARCH', 'SNS', 'ETC'))
);

CREATE INDEX newcomer_requests_created_idx ON newcomer_requests (created_at DESC);

COMMENT ON COLUMN newcomer_requests.agreed_at IS '개인정보 동의 시각. agreed=true가 아니면 애초에 저장하지 않는다';


-- ───────────────────────────────────────────────────────────────────────
--  감사 로그 — 권한 변경·승인 등 되짚어야 하는 행위
-- ───────────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
    id         bigserial    PRIMARY KEY,
    actor_id   bigint,                          -- 시스템 동작은 null
    action     varchar(50)  NOT NULL,           -- MEMBER_APPROVE · ROLE_CHANGE ...
    target     varchar(200),                    -- 대상 식별자
    detail     text,
    created_at timestamptz  NOT NULL DEFAULT now(),

    CONSTRAINT audit_logs_actor_fk FOREIGN KEY (actor_id)
        REFERENCES members (id) ON DELETE SET NULL
);

CREATE INDEX audit_logs_created_idx ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor_idx   ON audit_logs (actor_id);
