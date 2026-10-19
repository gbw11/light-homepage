import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenWatermark, watermarkText } from "./ScreenWatermark";

const USER = { name: "김도연a", phone: "010-1111-2222" };

describe("watermarkText — 월례회 워터마크와 같은 내용", () => {
  it("이름 · 연락처 뒷4자리 · 열람 시각(로컬)", () => {
    expect(watermarkText(USER, new Date(2026, 9, 19, 16, 5))).toBe("김도연a · 2222 · 2026-10-19 16:05");
  });

  it("연락처 전체는 넣지 않는다", () => {
    expect(watermarkText(USER, new Date())).not.toContain("1111");
  });
});

describe("ScreenWatermark", () => {
  it("본문 위에 열람자 문구를 덮고, 복사를 막는다", () => {
    render(
      <ScreenWatermark user={USER}>
        <p>회의 내용</p>
      </ScreenWatermark>,
    );

    const overlay = document.querySelector("[data-watermark]");
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay?.getAttribute("data-watermark")).toMatch(/^김도연a · 2222 · /);
    expect((overlay as HTMLElement).style.backgroundImage).toContain("data:image/svg+xml");

    const copy = new Event("copy", { bubbles: true, cancelable: true });
    fireEvent(screen.getByText("회의 내용"), copy);
    expect(copy.defaultPrevented).toBe(true);
    expect(screen.getByText(/열람자 정보/)).toBeInTheDocument();
  });
});
