/**
 * 백엔드 응답 타입 — docs/SPEC_API.md §1 의 공통 규약
 *
 * ⚠️ 이 파일은 API 계약이다. 백엔드와 합의 없이 바꾸지 않는다.
 *    비호환 변경은 PR 제목에 [CONTRACT] (docs/INTEGRATION.md §5)
 */

/** 에러 코드 — 이 7개만 사용한다 (SPEC_API §1.2) */
export const ERROR_CODES = [
  "UNAUTHORIZED", // 401 로그인 필요
  "FORBIDDEN", // 403 권한 부족
  "PENDING_APPROVAL", // 403 승인 대기 → /pending
  "NOT_FOUND", // 404 없음 또는 권한이 없어 숨김
  "VALIDATION_ERROR", // 400 입력값 오류 (field에 필드명)
  "STORAGE_LIMIT", // 409 저장 용량 초과
  "DUPLICATE", // 409 중복
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** 역할 — 계단식 상위 포함 (SPEC_API §1.5) */
export type Role = "GUEST" | "PENDING" | "MEMBER" | "LEADER" | "PASTOR";

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

// ── 인증·회원 (SPEC_API §2) ─────────────────────────────────
export type Village = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "newcomer";

/** GET /api/auth/me 전체 프로필 (SPEC_API §2.5) */
export type AuthUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  village: Village;
  role: Role;
  profileComplete: boolean;
  /** 승인 이전이면 null */
  approvedAt: string | null;
};

/** POST /api/auth/login 응답 — me()의 부분집합 (SPEC_API §2.2) */
export type LoginResult = Pick<AuthUser, "id" | "name" | "village" | "role" | "profileComplete">;

export type SignupInput = {
  name: string;
  email: string;
  password: string;
  phone: string;
  village: Village;
  agreed: boolean;
};

export type LoginInput = {
  email: string;
  password: string;
};

/** 카카오 가입자 추가정보 (SPEC_API §2.8) */
export type CompleteProfileInput = {
  name: string;
  phone: string;
  village: Village;
  agreed: boolean;
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

// ── 관리 (SPEC_API §8) ─────────────────────────────────────
/** 회원 관리 목록 항목 (SPEC_API §8.1) — 권한 `T` */
export type AdminMember = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  village: Village;
  role: Role;
  profileComplete: boolean;
  createdAt: string;
  approvedAt: string | null;
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

/** 주보 상세 (SPEC_API §5.1 · §5.3) */
export type Bulletin = {
  id: string;
  /** LocalDate — `YYYY-MM-DD` (주일 날짜) */
  serviceDate: string;
  pages: BulletinPage[];
};

/** 지난 주보 목록 항목 (SPEC_API §5.2) — 여기서는 썸네일을 쓴다 */
export type BulletinSummary = {
  id: string;
  serviceDate: string;
  pageCount: number;
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
