import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemberGate } from "./MemberGate";

/** USERFLOW_AUDIT 2026-10-07 🔵-1 — 게이트의 로그인 링크는 지금 화면을 next로 싣는다 */

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/photos/12",
}));

describe("MemberGate", () => {
  it("비로그인이면 로그인 링크에 지금 경로를 next로 붙인다", () => {
    render(
      <MemberGate>
        <p>회원 내용</p>
      </MemberGate>,
    );

    expect(screen.queryByText("회원 내용")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "로그인" })).toHaveAttribute(
      "href",
      "/login?next=%2Fphotos%2F12",
    );
  });
});
