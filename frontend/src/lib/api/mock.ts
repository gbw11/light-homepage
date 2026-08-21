import type { NewcomerSubmission, Page, PostSummary } from "@/types/api";
import { ApiError } from "./error";
import type { Api } from "./types";

/**
 * 백엔드 없이 화면을 완성하기 위한 mock.
 *
 * ★ 성공 경로만 만들면 통합 때 무너진다 (docs/INTEGRATION.md).
 *   실패 케이스를 반드시 함께 넣는다: 401 · 403 · PENDING_APPROVAL ·
 *   STORAGE_LIMIT · 업로드 실패 · 빈 목록.
 *
 * 강제 방법: 쿼리스트링 `?mock=unauthorized` 처럼 시나리오를 지정한다.
 */
const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms));

/** 현재 URL의 `?mock=` 값 (브라우저에서만) */
function scenario(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("mock");
}

function throwIfScenario() {
  switch (scenario()) {
    case "unauthorized":
      throw new ApiError({
        code: "UNAUTHORIZED",
        message: "로그인이 필요합니다.",
        status: 401,
      });
    case "forbidden":
      throw new ApiError({
        code: "FORBIDDEN",
        message: "권한이 없습니다.",
        status: 403,
      });
    case "pending":
      throw new ApiError({
        code: "PENDING_APPROVAL",
        message: "승인 대기 중입니다.",
        status: 403,
      });
    case "storage":
      throw new ApiError({
        code: "STORAGE_LIMIT",
        message: "저장 용량이 부족합니다.",
        status: 409,
      });
  }
}

const NOTICES: PostSummary[] = [
  {
    id: "18",
    category: "NOTICE_PUBLIC",
    title: "여름 수련회 신청 안내",
    slug: "summer-retreat-2026",
    pinned: true,
    authorName: "박OO",
    publishedAt: "2026-08-24T01:00:00Z",
    attachmentCount: 1,
  },
  {
    id: "17",
    category: "NOTICE_PUBLIC",
    title: "8월 마을모임 편성",
    slug: "august-village-groups",
    pinned: false,
    authorName: "김OO",
    publishedAt: "2026-08-10T01:00:00Z",
    attachmentCount: 0,
  },
];

export const mockApi: Api = {
  posts: {
    async list({ category, page = 0, size = 20 }): Promise<Page<PostSummary>> {
      await delay();
      throwIfScenario();

      // 빈 목록도 반드시 확인해야 하는 상태다
      const items = scenario() === "empty" ? [] : NOTICES.filter((p) => p.category === category);

      return { items, page, size, hasNext: false };
    },
  },
  newcomers: {
    async submit(input: NewcomerSubmission): Promise<{ id: string }> {
      await delay();
      throwIfScenario();

      if (input.agreed !== true) {
        throw new ApiError({
          code: "VALIDATION_ERROR",
          message: "개인정보 동의가 필요합니다.",
          status: 400,
          field: "agreed",
        });
      }

      return { id: `${Date.now()}` };
    },
  },
};
