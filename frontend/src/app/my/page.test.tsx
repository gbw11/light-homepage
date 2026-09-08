import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AuthUser, Role } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import MyHomePage from "./page";

/**
 * LIGHT-53 — 권한별 메뉴 렌더 테스트.
 *
 * `src/app/my/page.tsx`의 실제 분기는 `member?.role === "LEADER" || member?.role
 * === "PASTOR"`(`isAdmin`) 하나뿐이다. 즉 화면은 GUEST/MEMBER/LEADER/PASTOR
 * 네 값을 각각 다르게 그리는 게 아니라 **"로그인 안 함" / "일반 회원" / "임원
 * 이상(LEADER·PASTOR)"** 세 갈래로만 갈린다. 그래서 이 파일은 LEADER와
 * PASTOR를 별도 시나리오로 나누되, 둘 다 "관리 타일이 보인다"는 같은 결과를
 * 검증한다 — 실제 코드가 그렇게 되어 있기 때문이지, 두 역할을 더 세밀하게
 * 나누는 로직이 있어서가 아니다.
 *
 * "UI 숨김은 편의일 뿐 차단이 아니다"(WORKPLAN.md §5.1) 원칙대로, 여기서는
 * 클라이언트가 역할에 맞는 타일을 그리는지만 본다 — 서버 인가는 다루지 않는다.
 */

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api", () => ({
  api: {
    bulletins: { latest: vi.fn(() => new Promise(() => {})) },
    albums: { list: vi.fn(() => new Promise(() => {})) },
  },
}));

const mockUseAuth = vi.mocked(useAuth);

function makeUser(role: Role): AuthUser {
  return {
    id: "user-1",
    name: "홍길동",
    loginId: "hong",
    phone: "010-0000-0000",
    role,
  };
}

function renderPage(user: AuthUser | null) {
  mockUseAuth.mockReturnValue({
    user,
    isLoading: false,
    refetch: vi.fn(),
    logout: vi.fn(),
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MyHomePage />
    </QueryClientProvider>,
  );
}

describe("/my 권한별 메뉴 렌더", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("GUEST(비로그인)에게는 로그인 안내만 보이고 타일은 없다", () => {
    renderPage(null);

    expect(screen.getByRole("link", { name: "로그인" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /내 정보/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /관리 홈/ })).not.toBeInTheDocument();
  });

  it("MEMBER에게는 일반 타일만 보이고 관리 타일은 숨는다", () => {
    renderPage(makeUser("MEMBER"));

    expect(screen.getByRole("link", { name: /내 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /주보/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /사진첩/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /월례회 자료/ })).toBeInTheDocument();

    expect(screen.queryByRole("link", { name: /콘텐츠 작성/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^문서/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /관리 홈/ })).not.toBeInTheDocument();
  });

  it("LEADER에게는 일반 타일과 관리 타일이 함께 보인다", () => {
    renderPage(makeUser("LEADER"));

    expect(screen.getByRole("link", { name: /내 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /콘텐츠 작성/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^문서/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /관리 홈/ })).toBeInTheDocument();
  });

  it("PASTOR에게도 LEADER와 동일하게 관리 타일이 보인다", () => {
    renderPage(makeUser("PASTOR"));

    expect(screen.getByRole("link", { name: /내 정보/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /콘텐츠 작성/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^문서/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /관리 홈/ })).toBeInTheDocument();
  });
});
