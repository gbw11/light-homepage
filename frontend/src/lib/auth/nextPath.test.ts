import { describe, expect, it } from "vitest";
import { loginHref, safeNextPath } from "./nextPath";

describe("safeNextPath — 내부 경로만 허용 (🔵-1)", () => {
  it.each(["/news", "/news/abc-1?tab=x#top", "/my", "/"])("허용: %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "news",
    "//evil.com",
    "//evil.com/news",
    "/\\evil.com",
    "\\\\evil.com",
    "https://evil.com",
    "javascript:alert(1)",
    "/\tevil",
    "/news\nfoo",
    " /news",
  ])("거부: %s", (path) => {
    expect(safeNextPath(path)).toBeNull();
  });
});

describe("loginHref", () => {
  it("지금 경로를 next로 싣는다", () => {
    expect(loginHref("/news/abc?x=1")).toBe("/login?next=%2Fnews%2Fabc%3Fx%3D1");
  });

  it("경로가 없거나 안전하지 않거나 로그인 화면 자신이면 next 없이", () => {
    expect(loginHref(null)).toBe("/login");
    expect(loginHref("//evil.com")).toBe("/login");
    expect(loginHref("/login")).toBe("/login");
  });
});
