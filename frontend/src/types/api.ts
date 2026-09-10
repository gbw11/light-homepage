/**
 * 백엔드 응답 타입 — docs/spec/SPEC_API.md §1 의 공통 규약
 *
 * ⚠️ 이 파일은 API 계약이다. 백엔드와 합의 없이 바꾸지 않는다.
 *    비호환 변경은 PR 제목에 [CONTRACT] (docs/ops/INTEGRATION.md §5)
 */

/** 에러 코드 — 이 6개만 사용한다 (SPEC_API §1.2 v1.3 — PENDING_APPROVAL은 [CONTRACT] 제거) */
export const ERROR_CODES = [
  "UNAUTHORIZED", // 401 로그인 필요
  "FORBIDDEN", // 403 권한 부족
  "NOT_FOUND", // 404 없음 또는 권한이 없어 숨김
  "VALIDATION_ERROR", // 400 입력값 오류 (field에 필드명)
  "STORAGE_LIMIT", // 409 저장 용량 초과
  "DUPLICATE", // 409 중복
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** 역할 — 계단식 상위 포함 (SPEC_API §1.5 v1.3 — PENDING은 승인 폐지로 소멸) */
export type Role = "GUEST" | "MEMBER" | "LEADER" | "PASTOR";

/** 성공 응답 */
export type ApiSuccess<T> = { data: T };

/** 실패 응답 */
export type ApiFailure = {
  error: {
    code: ErrorCode;
    message: string;
    /** VALIDATION_ERROR일 때 문제가 된 필드명 */
    field: string | null;
  };
};

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

/** 페이지 목록 */
export type Page<T> = {
  items: T[];
  page: number;
  size: number;
  hasNext: boolean;
};

/** 커서 목록 (사진 전용) */
export type Cursor<T> = {
  items: T[];
  nextCursor: string | null;
  hasNext: boolean;
};

// ── 게시물 ────────────────────────────────────────────────
export type PostCategory =
  | "NOTICE_PUBLIC"
  | "NOTICE_MEMBER"
  | "MINUTES"
  | "BUDGET";

/** 목록용 요약 (SPEC_API §3.2) */
export type PostSummary = {
  /** ⚠️ ID는 문자열이다 (JS Number 정밀도) */
  id: string;
  category: PostCategory;
  title: string;
  slug: string;
  pinned: boolean;
  authorName: string;
  /** ISO-8601 UTC. **임시저장(`publish: false`)이면 null** (SPEC_API §3.4) */
  publishedAt: string | null;
  attachmentCount: number;
};

/** 첨부파일 (SPEC_API §3.3) */
export type PostAttachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

/**
 * 리치텍스트 본문 (Tiptap/ProseMirror JSON, SPEC_API §3.3).
 *
 * 노드 스키마를 여기서 좁히지 않는 이유: 에디터가 쓰는 확장 집합은
 * 바뀔 수 있고, 렌더러(`components/post/PostBodyView.tsx`)가 **모르는 노드는
 * 건너뛰는** 방식으로 이미 방어한다. 대신 화면이 실제로 다룰 수 있는
 * 노드/마크 집합은 `POST_BODY_NODES`/`POST_BODY_MARKS`로 한 곳에 고정해두고,
 * 에디터 툴바와 렌더러가 **같은 목록**을 참조한다.
 */
export type PostBody = {
  type: "doc";
  content: unknown[];
};

/**
 * ★ 에디터가 만들 수 있고 렌더러가 표시할 수 있는 블록 노드.
 *
 * ⚠️ 이 목록을 늘릴 때는 **에디터 툴바와 렌더러를 같이** 늘린다. 한쪽만
 *    늘리면 작성자가 쓴 내용이 화면에서 조용히 사라진다 (렌더러가 모르는
 *    노드를 버리기 때문).
 */
export const POST_BODY_NODES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "horizontalRule",
  "hardBreak",
] as const;

/** ★ 위와 같은 이유로 마크(인라인 서식)도 한 곳에 고정한다 */
export const POST_BODY_MARKS = ["bold", "italic", "underline", "strike", "link"] as const;

/** 글 작성·수정 요청 본문 (SPEC_API §3.4 · §3.5) — 권한 `L` */
export type PostInput = {
  category: PostCategory;
  title: string;
  body: PostBody;
  pinned: boolean;
  /** `attachments.upload`로 먼저 올린 뒤 받은 id 목록 */
  attachmentIds: string[];
  /** `false`면 임시저장 (`publishedAt = null`) */
  publish: boolean;
};

/** 첨부 업로드 응답 (SPEC_API §4.1) */
export type AttachmentUpload = {
  id: string;
  filename: string;
  sizeBytes: number;
};

/** 상세 조회 (SPEC_API §3.3) */
export type PostDetail = {
  id: string;
  category: PostCategory;
  title: string;
  slug: string;
  body: PostBody;
  pinned: boolean;
  authorName: string;
  /** ISO-8601 UTC. **임시저장(`publish: false`)이면 null** (SPEC_API §3.4) */
  publishedAt: string | null;
  /** ISO-8601 UTC */
  updatedAt: string;
  attachments: PostAttachment[];
};

// ── 인증·회원 (SPEC_API §2 v1.3 — 명단 대조 가입 · 즉시 MEMBER) ──────
/** 마을 — 인증 응답에서는 제거됐고([CONTRACT] 2026-08-31) 월례회 열람 로그에만 남는다 */
export type Village = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "newcomer";

/** GET /api/auth/me (SPEC_API §2.6) — email·village·profileComplete·approvedAt은 v1.3에서 제거 */
export type AuthUser = {
  id: string;
  /** 명단의 이름 그대로 — 동명이인 접미사 포함 (예: "김도연a") */
  name: string;
  /** 카카오 가입자면 null */
  loginId: string | null;
  phone: string;
  role: Role;
};

/** POST /api/auth/login 응답 — me()의 부분집합 (SPEC_API §2.3) */
export type LoginResult = Pick<AuthUser, "id" | "name" | "role">;

export type LoginInput = {
  loginId: string;
  password: string;
};

/** 가입 1단계 — 명단 확인 (SPEC_API §2.1) */
export type VerifyRosterInput = {
  /** 동명이인은 명단의 접미사 포함 (예: "김도연a") */
  name: string;
  /** YYYY-MM-DD */
  birthDate: string;
  phone: string;
};

/** 가입 1단계 응답 — 토큰은 1회용·5분 만료 */
export type VerifyRosterResult = {
  registrationToken: string;
  /** 명단에 적힌 그대로의 이름 */
  name: string;
  /** 초 단위 (300) */
  expiresIn: number;
};

/** 가입 2단계 — 계정 생성, 즉시 MEMBER (SPEC_API §2.2) */
export type RegisterInput = {
  registrationToken: string;
  loginId: string;
  password: string;
};

export type RegisterResult = {
  id: string;
  name: string;
  role: Role;
};

/** 리셋 코드로 비밀번호 재설정 (SPEC_API §2.9) — 코드는 전도사가 §8.4로 발급 */
export type ResetPasswordWithCodeInput = {
  loginId: string;
  resetCode: string;
  password: string;
};

// ── 월례회 (SPEC_API §7) ───────────────────────────────────
/**
 * ⚠️ 이 리소스는 **presigned URL을 발급하지 않는다** (SPEC_API §7 머리말).
 *    발급하면 열람 기간이 끝난 뒤에도 URL이 만료 전까지 살아있고 공유된다.
 *    페이지 이미지는 **서버가 직접 스트리밍**하고 워터마크도 서버가 합성한다.
 *    → FE는 `<img src="/api/meetings/{id}/pages/{n}">`처럼 **엔드포인트를 직접
 *      가리키고**, 이미지 URL을 저장·재사용하지 않는다.
 */
export type MeetingStatus = "SCHEDULED" | "OPEN" | "CLOSED";

/** 열람 불가 사유 (SPEC_API §7.2) */
export type MeetingViewReason = "PERIOD_CLOSED" | null;

export type MeetingSummary = {
  id: string;
  title: string;
  /** LocalDate */
  meetingDate: string;
  pageCount: number;
  viewableFrom: string;
  viewableUntil: string;
  status: MeetingStatus;
};

/** 단건 조회 (SPEC_API §7.2) */
export type MeetingDetail = {
  id: string;
  title: string;
  meetingDate: string;
  pageCount: number;
  status: MeetingStatus;
  viewableUntil: string;
  /** 남은 열람 시간(초). 카운트다운 표시용 */
  remainingSeconds: number;
  /**
   * 이 사용자가 지금 열람할 수 있는지. ⚠️ **UI 편의일 뿐 보안이 아니다** —
   * 서버가 페이지 스트리밍 시점에 다시 검사한다 (SPEC_API §7.3 처리 순서 2).
   * `L` 이상은 기간과 무관하게 `true`다.
   */
  canView: boolean;
  viewReason: MeetingViewReason;
};

/**
 * 업로드 요청 (SPEC_API §7.4) — `multipart/form-data`로 나간다.
 *
 * 서버가 PDFBox로 페이지 이미지를 만드는 데 **10페이지 기준 15~30초**가
 * 걸리고 그동안 응답이 오지 않는다. 그 대기를 화면이 설명해야 한다.
 */
export type MeetingCreateInput = {
  title: string;
  /** LocalDate `2026-08-24` */
  meetingDate: string;
  viewableFrom: string;
  viewableUntil: string;
  /** Word에서 「PDF로 저장」한 파일. ⚠️ 서버는 이 원본을 보관하지 않는다 */
  file: File;
};

/** 열람 기간 수정 (SPEC_API §7.5) — 연장·조기 종료 둘 다 이 요청이다 */
export type MeetingWindowInput = {
  viewableFrom: string;
  viewableUntil: string;
};

/**
 * 열람 로그 한 줄 (SPEC_API §7.7).
 *
 * ⚠️ 회원 개인정보다. 유출이 생겼을 때 워터마크와 대조하는 근거이지,
 *    평소에 누가 뭘 보는지 들여다보라고 있는 화면이 아니다.
 */
export type MeetingView = {
  memberName: string;
  /**
   * ⚠️ **null일 수 있다.** `member_roster.village`가 nullable이고 CHECK
   * 제약도 없어서, 교회 CSV에 마을 칸이 비면 그대로 null이 온다
   * (`AttendanceEntry.village`와 같은 이유 — 화면은 "마을 미배정"으로 묶는다).
   */
  village: Village | null;
  lastViewedAt: string;
  /** 어디까지 봤는지 — 워터마크 대조 시 페이지 범위를 좁혀준다 */
  maxPageNo: number;
};

// ── 관리 (SPEC_API §8 v1.3) ─────────────────────────────────
/** 회원 관리 목록 항목 (SPEC_API §8.1) — 권한 `T` */
export type AdminMember = {
  id: string;
  /** 접미사 포함 그대로 (예: "김도연a") */
  name: string;
  /** 카카오 가입자면 null */
  loginId: string | null;
  phone: string;
  role: Role;
  createdAt: string;
};

/** 비밀번호 리셋 코드 발급 응답 (SPEC_API §8.4) — 권한 `T` */
export type PasswordResetCode = {
  resetCode: string;
  expiresAt: string;
};

/** 저장 용량 (SPEC_API §8.5) — 권한 `L` */
export type StorageUsage = {
  usedBytes: number;
  limitBytes: number;
  usagePercent: number;
  photoCount: number;
  estimatedRemainingPhotos: number;
  /** 이 비율부터 경고 */
  warningThreshold: number;
  /** 이 비율부터 업로드 차단 */
  blockThreshold: number;
  uploadBlocked: boolean;
};

/** 새가족 등록 내역 (SPEC_API §8.6) — 권한 `L`. ⚠️ 개인정보, 보유기간 1년 */
export type NewcomerRecord = {
  id: string;
  name: string;
  phone: string;
  gender: Gender | null;
  ageGroup: AgeGroup | null;
  referrer: Referrer | null;
  message: string | null;
  createdAt: string;
};

/**
 * 헤더 알림 배지·목록 한 건 (§14 신설, BE PR `feat/be-newcomer-notification`,
 * `DECISIONS.md` 2026-09-09). 권한 `L`(임원) 이상. 본문(`message`)에 새가족
 * 이름이 그대로 들어간다.
 */
export type AdminNotification = {
  id: string;
  message: string;
  createdAt: string;
  read: boolean;
};

/**
 * `GET /api/admin/notifications` 응답.
 *
 * ⚠️ **배지는 `unreadCount`로 그린다.** `items`는 최근 20건으로 잘려서 오므로,
 * 21건째부터는 `items.length`를 세면 계속 "20"이 나온다 (BE 지적).
 *
 * ⚠️ **`readMarker`를 그대로 `POST .../read`의 `until`에 넣는다.** 클라이언트
 * 시계로 만든 타임스탬프를 넣으면, 읽는 사이 서버에 새로 들어온 알림이
 * 안 읽음으로 남는다.
 */
export type AdminNotificationsResponse = {
  unreadCount: number;
  items: AdminNotification[];
  readMarker: string;
};

// ── 주보 (SPEC_API §5) ─────────────────────────────────────
/**
 * 주보 한 페이지.
 *
 * ⚠️ 사진첩과 **로딩 전략이 반대다** — 주보는 글자가 작아서 썸네일이 아니라
 *    큰 이미지(장변 2048px)를 바로 제공한다 (SPEC_API §5.1, FR-BUL-03).
 */
export type BulletinPage = {
  pageNo: number;
  url: string;
  width: number;
  height: number;
};

/**
 * 설교 영상 한 편 (FR-PUB-09).
 *
 * ⚠️ **[CONTRACT] 스펙에 없는 신규 엔드포인트다** — 백엔드 합의 필요
 * (`docs/backend/BACKEND_HANDOFF.md` 2026-08-25 항목).
 *
 * YouTube Data API를 **백엔드가 프록시한다.** 브라우저에서 직접 부르지 않는
 * 이유는 하나뿐이다: **API 키를 클라이언트에 실을 수 없다.** `NEXT_PUBLIC_`으로
 * 넣으면 번들에 그대로 박히고(NFR-SEC-22), 키가 유출되면 쿼터를 남이 쓴다.
 */
export type Sermon = {
  /** YouTube 영상 id (`youtubeUrl`에서 파생 가능하지만 목록 키로 쓴다) */
  id: string;
  title: string;
  /** ISO-8601 UTC — 영상 게시 시각 */
  publishedAt: string;
  /** 시청 URL. 자체 플레이어를 두지 않고 새 탭으로 보낸다 (FR-PUB-09) */
  youtubeUrl: string;
  /**
   * 썸네일 URL (YouTube CDN, `i.ytimg.com`).
   * ⚠️ `next/image`에 넣지 않는다 — 외부 호스트라 `remotePatterns` 설정이
   * 필요하고, 그러면 우리 서버가 YouTube 이미지를 재가공해 캐시한다.
   * presigned URL과 같은 이유로 `<img>`를 쓴다 (COMPONENTS.md §6.1).
   */
  thumbnailUrl: string;
};

/**
 * 진행 중인 YouTube 라이브 (SPEC_API §4.2 — 신설 2026-09-01).
 *
 * 주일 청년예배가 **일요일 13:45 무렵** 라이브로 올라온다. 방송이 켜져 있으면
 * `/sermons` 맨 위가 "지난 영상 4편"에서 **라이브 화면**으로 바뀐다.
 *
 * ⚠️ **백엔드가 YouTube Data API를 프록시해서 판정한다.** API 키를 클라이언트에
 * 실을 수 없고, 브라우저에서 채널 페이지를 긁는 것도 CORS로 막힌다
 * (`Sermon` 주석과 같은 이유).
 *
 * 방송 중이 아니면 **`null`**이다 — 빈 객체나 `live: false` 플래그를 쓰지
 * 않는다. "없음"을 한 가지 모양으로만 표현해야 화면 분기가 하나로 끝난다.
 */
export type LiveStream = {
  /** YouTube 영상 id — FE가 임베드 주소(`youtube.com/embed/<id>`)를 만든다 */
  videoId: string;
  title: string;
  /** ISO-8601 UTC — 방송이 실제로 시작된 시각 */
  startedAt: string;
  /** 새 탭으로 보낼 시청 URL (`youtube.com/watch?v=...`) */
  watchUrl: string;
  /**
   * 썸네일 URL (YouTube CDN). 임베드가 막힌 환경(브라우저 확장·회사망)에서
   * 대신 보여준다. `Sermon.thumbnailUrl`과 같은 이유로 `next/image`에 넣지 않는다.
   */
  thumbnailUrl: string;
};

/** 주보 상세 (SPEC_API §5.1 · §5.3) */
export type Bulletin = {
  id: string;
  /** LocalDate — `YYYY-MM-DD` (주일 날짜) */
  serviceDate: string;
  pages: BulletinPage[];
};

/** 지난 주보 목록 항목 (SPEC_API §5.2) */
export type BulletinSummary = {
  id: string;
  serviceDate: string;
  pageCount: number;
  /**
   * ⚠️ **이름과 달리 썸네일이 아니다.** 1쪽 **원본**(장변 2048px WebP)의
   * presigned URL이다 — 서버가 이미지를 재가공하지 않는다 (WebP 디코딩에
   * 네이티브 라이브러리가 필요해 512MB 인스턴스에서 돌리지 않기로 했다.
   * BE 전달 2026-09-04).
   *
   * 그래서 목록은 **작게 그리고 반드시 지연 로딩한다** (`PastBulletinList`는
   * 48×64 + `loading="lazy"`). 사진첩의 `Photo.thumbUrl`(640px)과 다르다.
   *
   * 주보는 주 1회씩 쌓여 목록이 짧아 지금은 이 계약을 그대로 쓴다. 목록이
   * 길어져 부담되면 업로드 시 축소본을 함께 올리는 쪽으로 계약을 바꾼다
   * (PM 판단 2026-09-04 — 보류).
   */
  thumbUrl: string;
};

/**
 * 주보 업로드 (SPEC_API §5.4) — `multipart/form-data`.
 *
 * ⚠️ **배열 순서가 페이지 번호다.** 정렬 기준이 따로 없으므로 서버는 받은
 * 순서를 그대로 `pageNo`로 쓴다.
 */
export type BulletinInput = {
  /** `YYYY-MM-DD` (주일 날짜) */
  serviceDate: string;
  /** 2048px WebP로 변환된 페이지 이미지. **1장 이상** */
  pages: Blob[];
};

// ── 사진첩 (SPEC_API §6) ───────────────────────────────────
/** 앨범 목록 항목 (SPEC_API §6.1) */
export type AlbumSummary = {
  id: string;
  title: string;
  /** LocalDate — `YYYY-MM-DD` */
  eventDate: string;
  photoCount: number;
  /** presigned URL. 사진이 없는 앨범은 null */
  coverThumbUrl: string | null;
};

/** 앨범 사진 (SPEC_API §6.4) — 커서 페이징으로 받는다 */
export type Photo = {
  id: string;
  /** 640px. **그리드는 이것만 쓴다** */
  thumbUrl: string;
  /** 확대·다운로드용 */
  viewUrl: string;
  width: number;
  height: number;
  /** ISO-8601 UTC. EXIF가 없으면 null */
  takenAt: string | null;
};

export type AlbumInput = {
  title: string;
  eventDate: string;
};

// ── 사진 업로드 (SPEC_API §6.5 · §6.6) ─────────────────────
/**
 * `uploads:issue`에 보내는 파일 하나의 메타 (SPEC_API §6.5).
 *
 * ⚠️ 크기·해상도는 **리사이즈 후** 값이다. 서버가 이 값으로 용량 한도를
 * 검사하므로(§6.5 `STORAGE_LIMIT`) 촬영 원본 크기를 보내면 멀쩡한 업로드가
 * 막힌다.
 */
export type UploadFileMeta = {
  /** 브라우저가 붙이는 임시 식별자. 응답의 `photoId`와 짝지을 때만 쓴다 */
  clientId: string;
  /** 2560px WebP 크기 */
  sizeBytes: number;
  /** 640px WebP 크기 */
  thumbSizeBytes: number;
  width: number;
  height: number;
  /** EXIF 촬영 시각 (ISO-8601). 없으면 null */
  takenAt: string | null;
};

export type UploadIssueInput = {
  albumId: string;
  files: UploadFileMeta[];
};

/** 발급된 presigned PUT URL 한 쌍 (SPEC_API §6.5) */
export type UploadTicket = {
  clientId: string;
  photoId: string;
  viewPutUrl: string;
  thumbPutUrl: string;
  /** 초. 기본 900(15분) — 200장은 배치로 나눠 재발급한다 */
  expiresIn: number;
};

/** `uploads:commit` 결과 (SPEC_API §6.6) */
export type UploadCommitResult = {
  committed: string[];
  /** `OBJECT_NOT_FOUND` 등 — 해당 photoId는 재시도 대상이다 */
  failed: { photoId: string; reason: string }[];
};

// ── 새가족 등록 (SPEC_API §9.1) ────────────────────────────
export type Gender = "MALE" | "FEMALE";
export type AgeGroup = "EARLY_20S" | "LATE_20S" | "EARLY_30S" | "LATE_30S";
export type Referrer = "FRIEND" | "SEARCH" | "SNS" | "ETC";

export type NewcomerSubmission = {
  name: string;
  phone: string;
  gender?: Gender;
  ageGroup?: AgeGroup;
  referrer?: Referrer;
  message?: string;
  agreed: boolean;
  /** 스팸 방지용 hidden 필드 — 값이 있으면 봇으로 간주 */
  honeypot?: string;
};

// ── 출석부 (신규) ──────────────────────────────────────────

/**
 * ⚠️ **[CONTRACT] 출석부는 `SPEC_API.md`에 아직 없다.**
 * `docs/handoff/2026-08-28-auth-roster-model.md §7` **초안**을 그대로 옮긴
 * 것이고, §9-E 확정 시 별도 브리핑으로 계약이 된다. 그 전까지 백엔드 합의
 * 없이 이 블록에 필드를 늘리지 않는다.
 *
 * ⚠️ **출결 대상은 계정(member)이 아니라 명단(member_roster)이다** — 계정을
 * 만들지 않은 교인도 출석은 체크한다 (§7). 그래서 키가 `rosterId`다.
 *
 * ⚠️ 출석 데이터는 "누가 교회에 안 나왔는지"의 기록이다 — 예산안과 같은 급의
 * 민감 정보로 다룬다. 응답에 전화번호 등 불필요한 개인정보를 싣지 않는다 (§7).
 */
export type AttendanceStatus = "PRESENT" | "LATE" | "ABSENT" | "EXCUSED";

/** §7 예시는 SUNDAY_SERVICE 하나만 보여준다. 그 외 모임은 ETC로 묶는다 (합의 대상) */
export type AttendanceSessionType = "SUNDAY_SERVICE" | "ETC";

/** 회차 목록 한 줄 — `GET /attendance/sessions` (권한 `L`) */
export type AttendanceSessionSummary = {
  id: string;
  /** "YYYY-MM-DD" — 시간이 아니라 날짜다 (회차는 하루 단위) */
  date: string;
  type: AttendanceSessionType;
  title: string;
  /** 상태가 기록된 인원 (PRESENT든 ABSENT든) — 목록에서 "얼마나 체크했나"를 보여준다 */
  checkedCount: number;
  /** PRESENT 인원 */
  presentCount: number;
  /** 명단(active) 전체 인원 */
  rosterCount: number;
};

/** 회차 상세의 한 사람 — 명단 기준이라 계정 없는 교인도 들어 있다 */
export type AttendanceEntry = {
  rosterId: string;
  name: string;
  /**
   * ⚠️ **null일 수 있다.** 출결 대상은 계정이 아니라 명단(`member_roster`)이고,
   * 명단의 마을은 교회가 준 CSV에서 오는데 **그 열이 비어 있을 수 있다**
   * (BE `member_roster.village`는 nullable이며 CHECK 제약도 없다).
   * 화면은 이 사람들을 "마을 미배정"으로 묶는다 — 여기서 non-null로 두면
   * 실제 명단이 들어온 날 `null마을`이라는 제목이 화면에 뜬다.
   */
  village: Village | null;
  /** null = 아직 체크하지 않음 (ABSENT와 다르다 — "기록 없음") */
  status: AttendanceStatus | null;
};

/** `GET /attendance/sessions/{id}` — 회차 + 명단 전원의 출결 (권한 `L`) */
export type AttendanceSessionDetail = {
  id: string;
  date: string;
  type: AttendanceSessionType;
  title: string;
  /** 마을 → 이름 순 정렬. 체크 화면이 마을 단위로 도는 것을 전제한다 */
  entries: AttendanceEntry[];
};

/** `POST /attendance/sessions` 요청 본문 */
export type AttendanceSessionInput = {
  date: string;
  type: AttendanceSessionType;
  title: string;
};

/**
 * `PUT /attendance/sessions/{id}/entries` 요청 본문의 원소.
 * ⚠️ **전체 교체가 아니라 upsert다** (§7) — 화면은 **손댄 사람만** 보낸다.
 * 두 임원이 동시에 다른 마을을 체크할 때 서로를 덮어쓰지 않기 위한 규약이다.
 */
export type AttendanceEntryInput = {
  rosterId: string;
  status: AttendanceStatus;
};
