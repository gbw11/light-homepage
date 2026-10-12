import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAuth } from "@/components/providers/AuthProvider";
import { Header } from "./Header";

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("./NotificationBell", () => ({ NotificationBell: () => null }));

vi.mocked(useAuth).mockReturnValue({
  user: null,
  isLoading: false,
  logout: vi.fn(),
} as unknown as ReturnType<typeof useAuth>);

describe("Header — 데스크톱 자료 드롭다운 (점검 🔵-3)", () => {
  it("모바일 메뉴처럼 회원 전용임을 표시한다", () => {
    render(<Header />);

    const trigger = screen.getByRole("button", { name: "자료 · 회원 전용" });
    const menu = document.getElementById(trigger.getAttribute("aria-controls") ?? "");
    expect(menu).not.toBeNull();
    expect(within(menu as HTMLElement).getByText("회원 전용")).toBeInTheDocument();
    expect(within(menu as HTMLElement).getByRole("link", { name: "사진첩" })).toHaveAttribute(
      "href",
      "/photos",
    );
  });
});
