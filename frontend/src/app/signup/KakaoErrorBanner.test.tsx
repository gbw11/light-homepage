import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { KakaoErrorBanner } from "./KakaoErrorBanner";

/** USERFLOW_AUDIT 2026-10-07 🟠-2 — `/signup?error=kakao` 안내 배너 */

let query = "";
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(query),
}));

describe("KakaoErrorBanner", () => {
  beforeEach(() => {
    query = "";
  });

  it("error=kakao면 명단 확인부터 다시 하라는 안내를 보여준다", () => {
    query = "error=kakao";
    render(<KakaoErrorBanner />);
    expect(screen.getByRole("alert")).toHaveTextContent("카카오 로그인을 완료하지 못했습니다");
    expect(screen.getByRole("alert")).toHaveTextContent("명단 확인부터");
  });

  it("파라미터가 없거나 다른 값이면 아무것도 그리지 않는다", () => {
    const { container, rerender } = render(<KakaoErrorBanner />);
    expect(container).toBeEmptyDOMElement();

    query = "error=other";
    rerender(<KakaoErrorBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});
