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
  /** ISO-8601 UTC */
  publishedAt: string;
  attachmentCount: number;
};

/** 첨부파일 (SPEC_API §3.3) */
export type PostAttachment = {
  id: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
};

/** 리치텍스트 본문 — 이번 단위는 문단(`paragraph`)만 렌더한다 */
export type PostBody = {
  type: "doc";
  content: unknown[];
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
  /** ISO-8601 UTC */
  publishedAt: string;
  /** ISO-8601 UTC */
  updatedAt: string;
  attachments: PostAttachment[];
};
