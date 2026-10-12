import { describe, expect, it } from "vitest";
import { pageOf } from "./mock";

describe("pageOf — mock 목록을 실서버 PageResponse처럼 자른다 (점검 🟠-5)", () => {
  const all = Array.from({ length: 45 }, (_, i) => i);

  it("뒤에 더 있으면 hasNext: true", () => {
    expect(pageOf(all, 0, 20)).toEqual({
      items: all.slice(0, 20),
      page: 0,
      size: 20,
      hasNext: true,
    });
    expect(pageOf(all, 1, 20).hasNext).toBe(true);
  });

  it("마지막 페이지는 hasNext: false", () => {
    const last = pageOf(all, 2, 20);
    expect(last.items).toEqual([40, 41, 42, 43, 44]);
    expect(last.hasNext).toBe(false);
  });

  it("딱 떨어지는 경우 다음 빈 페이지를 약속하지 않는다", () => {
    expect(pageOf(all.slice(0, 40), 1, 20).hasNext).toBe(false);
  });

  it("빈 목록", () => {
    expect(pageOf([], 0, 20)).toEqual({ items: [], page: 0, size: 20, hasNext: false });
  });
});
