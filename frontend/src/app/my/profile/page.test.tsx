import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import ProfilePage from "./page";

/** USERFLOW_AUDIT 2026-10-07 🔵-8 — 카카오 가입자(loginId null)에게 비밀번호 변경 폼을 숨긴다 */

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));
vi.mock("./_components/ProfileInfo", () => ({ ProfileInfo: () => <p>프로필</p> }));
vi.mock("./_components/PasswordChangeForm", () => ({ PasswordChangeForm: () => <p>비밀번호 변경 폼</p> }));
vi.mock("./_components/AccountActions", () => ({ AccountActions: () => <p>계정 관리</p> }));

function renderWith(loginId: string | null) {
  const user: AuthUser = { id: "1", name: "홍길동", loginId, phone: "010-0000-0000", role: "MEMBER" };
  vi.mocked(useAuth).mockReturnValue({
    user,
    isLoading: false,
    refetch: vi.fn(),
    logout: vi.fn(),
    clearSession: vi.fn(),
  });
  render(<ProfilePage />);
}

describe("/my/profile 비밀번호 변경 노출", () => {
  it("아이디 가입자에게는 비밀번호 변경 폼을 보여준다", () => {
    renderWith("hong");
    expect(screen.getByText("비밀번호 변경 폼")).toBeInTheDocument();
  });

  it("카카오 가입자(loginId null)에게는 폼 대신 안내를 보여준다", () => {
    renderWith(null);
    expect(screen.queryByText("비밀번호 변경 폼")).not.toBeInTheDocument();
    expect(screen.getByText(/카카오로 가입한 계정은 비밀번호가 없습니다/)).toBeInTheDocument();
    expect(screen.getByText("계정 관리")).toBeInTheDocument();
  });
});
