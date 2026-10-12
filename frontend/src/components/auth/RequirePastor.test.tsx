import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, Role } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { RequirePastor } from "./RequirePastor";

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const mockUseAuth = vi.mocked(useAuth);

function renderAs(role: Role) {
  const user: AuthUser = { id: "u1", name: "홍길동", loginId: "hong", phone: "010-0000-0000", role };
  mockUseAuth.mockReturnValue({ user, isLoading: false, refetch: vi.fn(), logout: vi.fn() });
  return render(
    <RequirePastor>
      <p>회원 목록</p>
    </RequirePastor>,
  );
}

describe("RequirePastor — 권한 거부 화면 (점검 🔵-5)", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
  });

  it("폐지된 '회원 승인'을 말하지 않는다", () => {
    renderAs("LEADER");

    expect(screen.getByRole("alert")).toHaveTextContent("권한이 없습니다");
    expect(screen.getByRole("alert")).not.toHaveTextContent("승인");
  });

  it("임원에게는 [관리 홈으로]를 보여준다", () => {
    renderAs("LEADER");

    expect(screen.getByRole("link", { name: "관리 홈으로" })).toHaveAttribute("href", "/admin");
  });

  it("일반 회원에게는 관리 홈(역시 거부) 대신 [나의 LIGHT로]를 보여준다", () => {
    renderAs("MEMBER");

    expect(screen.queryByRole("link", { name: "관리 홈으로" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "나의 LIGHT로" })).toHaveAttribute("href", "/my");
  });

  it("전도사에게는 내용을 그대로 보여준다", () => {
    renderAs("PASTOR");

    expect(screen.getByText("회원 목록")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
