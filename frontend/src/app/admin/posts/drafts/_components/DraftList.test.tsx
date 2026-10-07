import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostSummary } from "@/types/api";
import { api } from "@/lib/api";
import { DraftList } from "./DraftList";

vi.mock("@/lib/api", () => ({
  api: { posts: { drafts: vi.fn() } },
  isApiError: () => false,
}));

const mockDrafts = vi.mocked(api.posts.drafts);

function draft(id: string, title: string, overrides: Partial<PostSummary> = {}): PostSummary {
  return {
    id,
    category: "NOTICE_MEMBER",
    title,
    slug: null,
    pinned: false,
    authorName: "박도연",
    publishedAt: null,
    attachmentCount: 0,
    ...overrides,
  } as PostSummary;
}

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DraftList />
    </QueryClientProvider>,
  );
}

describe("DraftList — 임시저장 글 다시 열기 (점검 🔴-2)", () => {
  beforeEach(() => {
    mockDrafts.mockReset();
  });

  it("임시저장 글을 분류와 함께 보여주고, 누르면 수정 화면으로 간다", async () => {
    mockDrafts.mockResolvedValue({
      items: [
        draft("21", "쓰던 수련회 공지"),
        draft("19", "9월 예산 초안", { category: "BUDGET", attachmentCount: 2 }),
      ],
      page: 0,
      size: 20,
      hasNext: false,
    });
    renderList();

    const first = await screen.findByRole("link", { name: /쓰던 수련회 공지/ });
    expect(first).toHaveAttribute("href", "/admin/posts/21/edit");
    expect(first).toHaveTextContent("공지(회원)");

    const budget = screen.getByRole("link", { name: /9월 예산 초안/ });
    expect(budget).toHaveAttribute("href", "/admin/posts/19/edit");
    expect(budget).toHaveTextContent("예산안");
    expect(budget).toHaveTextContent("📎 2");
  });

  it("없으면 안내와 새 글 쓰기 링크", async () => {
    mockDrafts.mockResolvedValue({ items: [], page: 0, size: 20, hasNext: false });
    renderList();

    expect(await screen.findByText("임시저장한 글이 없습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /새 글 쓰기/ })).toHaveAttribute("href", "/admin/posts/new");
  });

  it("다음 페이지가 있으면 더 보기", async () => {
    mockDrafts.mockResolvedValue({ items: [draft("1", "초안")], page: 0, size: 20, hasNext: true });
    renderList();

    expect(await screen.findByRole("button", { name: "더 보기" })).toBeInTheDocument();
  });
});
