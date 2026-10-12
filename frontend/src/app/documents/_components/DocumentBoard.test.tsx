import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, Role } from "@/types/api";
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

function renderBoard(role: Role, initialCategory?: DocumentCategory) {
  const user: AuthUser = { id: "u1", name: "홍길동", loginId: "hong", phone: "010-0000-0000", role };
  mockUseAuth.mockReturnValue({ user, isLoading: false, refetch: vi.fn(), logout: vi.fn() });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentBoard initialCategory={initialCategory} />
    </QueryClientProvider>,
  );
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
    expect(mockList).toHaveBeenCalledWith({ category: "BUDGET" });
  });

  it("기본은 회의록 탭이다", () => {
    renderBoard("LEADER");

    expect(screen.getByRole("tab", { name: "회의록" })).toHaveAttribute("aria-selected", "true");
    expect(mockList).toHaveBeenCalledWith({ category: "MINUTES" });
  });

  it("일반 회원이 예산안으로 들어오면 회의록 탭으로 되돌리고 예산안은 조회하지 않는다", () => {
    renderBoard("MEMBER", "BUDGET");

    expect(screen.queryByRole("tab", { name: "예산안" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "회의록" })).toHaveAttribute("aria-selected", "true");
    expect(mockList).not.toHaveBeenCalledWith({ category: "BUDGET" });
  });
});
