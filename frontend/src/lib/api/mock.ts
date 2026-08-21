import type { Page, PostDetail, PostSummary } from "@/types/api";
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
  {
    id: "16",
    category: "NOTICE_PUBLIC",
    title: "여름 성경학교 후기",
    slug: "summer-bible-school-recap",
    pinned: false,
    authorName: "이OO",
    publishedAt: "2026-08-05T01:00:00Z",
    attachmentCount: 0,
  },
  {
    id: "15",
    category: "NOTICE_PUBLIC",
    title: "청년교회 사진관 오픈 안내",
    slug: "photo-gallery-open",
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-07-28T01:00:00Z",
    attachmentCount: 0,
  },
];

/** `PostSummary`에 상세 조회용 `body`/`attachments`만 덧붙인 것 — 목록과 동일 소스를 공유한다 */
const NOTICE_DETAILS: Record<string, Pick<PostDetail, "body" | "updatedAt" | "attachments">> = {
  "18": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "이번 여름 수련회는 8월 24일부터 26일까지 진행됩니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "참가를 원하시는 분은 첨부된 신청서를 작성해 마을장에게 제출해 주세요." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "궁금한 점은 마을모임 시간에 안내드리겠습니다." }],
        },
      ],
    },
    updatedAt: "2026-08-24T01:00:00Z",
    attachments: [
      {
        id: "7",
        filename: "신청서.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 24576,
      },
    ],
  },
  "17": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "8월 마을모임이 새롭게 편성되었습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "각 마을장에게 개별 안내드렸으니 확인해 주세요." }],
        },
      ],
    },
    updatedAt: "2026-08-10T01:00:00Z",
    attachments: [],
  },
  "16": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "지난주 여름 성경학교가 은혜롭게 마무리되었습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "함께해주신 모든 분들께 감사드립니다." }],
        },
      ],
    },
    updatedAt: "2026-08-05T01:00:00Z",
    attachments: [],
  },
  "15": {
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "청년교회 사진관이 새롭게 열렸습니다." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "회원 로그인 후 사진첩 메뉴에서 확인하실 수 있습니다." }],
        },
      ],
    },
    updatedAt: "2026-07-28T01:00:00Z",
    attachments: [],
  },
};

export const mockApi: Api = {
  posts: {
    async list({ category, page = 0, size = 20 }): Promise<Page<PostSummary>> {
      await delay();
      throwIfScenario();

      // 빈 목록도 반드시 확인해야 하는 상태다
      const items = scenario() === "empty" ? [] : NOTICES.filter((p) => p.category === category);

      return { items, page, size, hasNext: false };
    },

    async get(idOrSlug: string): Promise<PostDetail> {
      await delay();
      throwIfScenario();

      const summary = NOTICES.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
      const detail = summary ? NOTICE_DETAILS[summary.id] : undefined;

      if (!summary || !detail) {
        throw new ApiError({
          code: "NOT_FOUND",
          message: "글을 찾을 수 없습니다.",
          status: 404,
        });
      }

      return {
        id: summary.id,
        category: summary.category,
        title: summary.title,
        slug: summary.slug,
        body: detail.body,
        pinned: summary.pinned,
        authorName: summary.authorName,
        publishedAt: summary.publishedAt,
        updatedAt: detail.updatedAt,
        attachments: detail.attachments,
      };
    },
  },
};
