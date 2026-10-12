import { describe, expect, it } from "vitest";
import { SITE_URL } from "@/lib/site";
import sitemap from "./sitemap";

const paths = sitemap().map((entry) => entry.url.slice(SITE_URL.length) || "/");

describe("sitemap — 공개 화면만, 빠짐없이 (점검 🔵-4)", () => {
  it("조직도·지난 말씀·개인정보처리방침이 들어 있다", () => {
    expect(paths).toEqual(
      expect.arrayContaining(["/about/organization", "/sermons/all", "/privacy", "/contact"]),
    );
  });

  it("회원·운영 화면은 넣지 않는다", () => {
    for (const p of paths) {
      expect(p).not.toMatch(/^\/(my|admin|photos|bulletin|meetings|documents)(\/|$)/);
    }
  });
});
