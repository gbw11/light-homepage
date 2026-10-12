import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostSummary } from "@/types/api";
import { api } from "@/lib/api";
import { DocumentBoard } from "./DocumentBoard";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "1", role: "MEMBER" } }),
}));
vi.mock("@/lib/api", () => ({
  api: { posts: { list: vi.fn() } },
  isApiError: () => false,
}));

const mockList = vi.mocked(api.posts.list);

function minutes(n: number): PostSummary {
  return {
    id: `m${n}`,
    category: "MINUTES",
    title: `회의록 ${n}`,
    slug: `minutes-${n}`,
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-08-01T00:00:00Z",
    attachmentCount: 0,
  };
}

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentBoard />
    </QueryClientProvider>,
  );
}

describe("DocumentBoard — 21번째 문서부터 (점검 🟠-5)", () => {
  beforeEach(() => mockList.mockReset());

  it("hasNext면 더 보기로 다음 페이지를 이어 붙인다", async () => {
    mockList.mockImplementation(async (params) =>
      (params?.page ?? 0) === 0
        ? { items: [minutes(1), minutes(2)], page: 0, size: 2, hasNext: true }
        : { items: [minutes(3)], page: 1, size: 2, hasNext: false },
    );
    renderBoard();

    expect(await screen.findByText("회의록 2")).toBeInTheDocument();
    expect(screen.queryByText("회의록 3")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("회의록 3")).toBeInTheDocument();
    expect(screen.getByText("회의록 1")).toBeInTheDocument();
    expect(mockList).toHaveBeenLastCalledWith({ category: "MINUTES", page: 1 });
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });
});
