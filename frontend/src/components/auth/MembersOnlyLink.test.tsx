import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { MembersOnlyLink } from "./MembersOnlyLink";

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);

const MEMBER: AuthUser = {
  id: "u1",
  name: "홍길동",
  loginId: "hong",
  phone: "010-1234-5678",
  role: "MEMBER",
};

describe("MembersOnlyLink — 회원 전용 진입점은 로그인 시에만 (점검 🟠-1)", () => {
  it("비로그인이면 아무것도 그리지 않는다", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<MembersOnlyLink href="/photos">▸ 사진첩</MembersOnlyLink>);
    expect(container).toBeEmptyDOMElement();
  });

  it("인증 확인 중에도 그리지 않는다", () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: true } as unknown as ReturnType<typeof useAuth>);
    const { container } = render(<MembersOnlyLink href="/photos">▸ 사진첩</MembersOnlyLink>);
    expect(container).toBeEmptyDOMElement();
  });

  it("로그인했으면 링크를 그린다", () => {
    mockUseAuth.mockReturnValue({ user: MEMBER, isLoading: false } as unknown as ReturnType<typeof useAuth>);
    render(<MembersOnlyLink href="/photos">▸ 사진첩</MembersOnlyLink>);
    expect(screen.getByRole("link", { name: "▸ 사진첩" })).toHaveAttribute("href", "/photos");
  });
});
