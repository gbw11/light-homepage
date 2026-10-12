import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, PostSummary, Role } from "@/types/api";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { DocumentBoard, parseDocumentTab, type DocumentCategory } from "./DocumentBoard";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: { posts: { list: vi.fn() } },
  isApiError: () => false,
}));

const mockUseAuth = vi.mocked(useAuth);
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

function renderBoard(role: Role, initialCategory?: DocumentCategory) {
  const user: AuthUser = { id: "u1", name: "홍길동", loginId: "hong", phone: "010-0000-0000", role };
  mockUseAuth.mockReturnValue({ user, isLoading: false, refetch: vi.fn(), logout: vi.fn(), clearSession: vi.fn() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentBoard initialCategory={initialCategory} />
    </QueryClientProvider>,
  );
}

/** 이 카테고리를 한 번이라도 조회했는가 — 페이지 번호는 따지지 않는다 */
function listedCategory(category: DocumentCategory) {
  return mockList.mock.calls.some(([params]) => params?.category === category);
}

describe("DocumentBoard — 처음 열 탭 (점검 🔵-11)", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockList.mockReturnValue(new Promise(() => {}));
  });

  it("?tab=budget만 예산안이고 나머지는 회의록이다", () => {
    expect(parseDocumentTab("budget")).toBe("BUDGET");
    expect(parseDocumentTab(undefined)).toBe("MINUTES");
    expect(parseDocumentTab("BUDGET")).toBe("MINUTES");
    expect(parseDocumentTab(["budget", "x"])).toBe("MINUTES");
  });

  it("임원이 예산안으로 들어오면 예산안 탭이 선택되고 예산안을 조회한다", () => {
    renderBoard("LEADER", "BUDGET");

    expect(screen.getByRole("tab", { name: "예산안" })).toHaveAttribute("aria-selected", "true");
    expect(listedCategory("BUDGET")).toBe(true);
  });

  it("기본은 회의록 탭이다", () => {
    renderBoard("LEADER");

    expect(screen.getByRole("tab", { name: "회의록" })).toHaveAttribute("aria-selected", "true");
    expect(listedCategory("MINUTES")).toBe(true);
  });

  it("일반 회원이 예산안으로 들어오면 회의록 탭으로 되돌리고 예산안은 조회하지 않는다", () => {
    renderBoard("MEMBER", "BUDGET");

    expect(screen.queryByRole("tab", { name: "예산안" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "회의록" })).toHaveAttribute("aria-selected", "true");
    expect(listedCategory("BUDGET")).toBe(false);
  });
});

describe("DocumentBoard — 21번째 문서부터 (점검 🟠-5)", () => {
  beforeEach(() => mockList.mockReset());

  it("hasNext면 더 보기로 다음 페이지를 이어 붙인다", async () => {
    mockList.mockImplementation(async (params) =>
      (params?.page ?? 0) === 0
        ? { items: [minutes(1), minutes(2)], page: 0, size: 2, hasNext: true }
        : { items: [minutes(3)], page: 1, size: 2, hasNext: false },
    );
    renderBoard("MEMBER");

    expect(await screen.findByText("회의록 2")).toBeInTheDocument();
    expect(screen.queryByText("회의록 3")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("회의록 3")).toBeInTheDocument();
    expect(screen.getByText("회의록 1")).toBeInTheDocument();
    expect(mockList).toHaveBeenLastCalledWith({ category: "MINUTES", page: 1 });
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });
});
