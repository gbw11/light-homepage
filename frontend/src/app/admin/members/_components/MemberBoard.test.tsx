import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminMember, Page } from "@/types/api";
import { api } from "@/lib/api";
import { MemberBoard, memberCountLabel } from "./MemberBoard";

vi.mock("@/lib/api", () => ({
  api: { admin: { members: vi.fn() } },
  isApiError: () => false,
}));
// 로그인한 전도사 = 목록의 id "1"(강가온)
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: { id: "1", role: "PASTOR" } }),
}));

const mockMembers = vi.mocked(api.admin.members);

function member(id: string, name: string): AdminMember {
  return {
    id,
    name,
    loginId: `user${id}`,
    phone: "010-0000-0000",
    role: "MEMBER",
    createdAt: "2026-08-19T09:00:00Z",
  };
}

const PAGES: Page<AdminMember>[] = [
  { items: [member("1", "강가온"), member("2", "김다온")], page: 0, size: 2, hasNext: true },
  { items: [member("3", "박라온")], page: 1, size: 2, hasNext: false },
];

function renderBoard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemberBoard />
    </QueryClientProvider>,
  );
}

describe("memberCountLabel — 전체 수는 끝까지 불러왔을 때만 (점검 🟠-5)", () => {
  it("뒤에 더 있으면 '전체'라고 하지 않는다", () => {
    expect(memberCountLabel(20, true)).toBe("20명 표시 중 · 더 있음");
  });
  it("끝까지 불러왔으면 전체 수", () => {
    expect(memberCountLabel(23, false)).toBe("전체 23명");
  });
});

describe("MemberBoard — 페이지 넘김 (점검 🟠-5)", () => {
  beforeEach(() => {
    mockMembers.mockReset();
    mockMembers.mockImplementation(async (params) => PAGES[params?.page ?? 0]);
  });

  it("더 보기로 다음 회원을 이어 붙이고, 끝까지 오면 전체 수를 보여준다", async () => {
    renderBoard();
    expect(await screen.findByText("김다온")).toBeInTheDocument();
    expect(screen.getByText("2명 표시 중 · 더 있음")).toBeInTheDocument();
    expect(screen.queryByText("박라온")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("박라온")).toBeInTheDocument();
    expect(screen.getByText("전체 3명")).toBeInTheDocument();
    expect(mockMembers).toHaveBeenLastCalledWith({ q: undefined, page: 1 });
  });

  it("로그인한 본인 행에만 [삭제]가 없다 (🔵-13)", async () => {
    renderBoard();
    expect(await screen.findByText("김다온")).toBeInTheDocument();
    // 강가온(본인) · 김다온 두 행 중 삭제 버튼은 하나
    expect(screen.getAllByRole("button", { name: "삭제" })).toHaveLength(1);
  });
});
