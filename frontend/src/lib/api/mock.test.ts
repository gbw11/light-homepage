import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockApi, pageOf } from "./mock";

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

describe("mock deleteMember — 실서버 §8.2와 같은 실패 (점검 §5 mock 불일치)", () => {
  const PASTOR = { id: "1", name: "최전도", loginId: "pastor1", phone: "010-7777-8888", role: "PASTOR" };

  beforeEach(() => {
    window.localStorage.setItem("light-mock-session", JSON.stringify(PASTOR));
  });
  afterEach(() => {
    window.localStorage.removeItem("light-mock-session");
  });

  it("자기 계정은 400 VALIDATION_ERROR", async () => {
    await expect(mockApi.admin.deleteMember("1", { reason: "테스트" })).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      status: 400,
    });
  });

  it("사유 500자 초과는 400", async () => {
    await expect(
      mockApi.admin.deleteMember("101", { reason: "가".repeat(501) }),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "reason" });
  });

  it("다른 회원은 실제로 지워져 목록에서 빠진다", async () => {
    await mockApi.admin.deleteMember("101", { reason: "본인 확인 — 선점 계정 삭제" });
    const all = await mockApi.admin.members({ size: 100 });
    expect(all.items.some((m) => m.id === "101")).toBe(false);
    expect(all.items.some((m) => m.id === "1")).toBe(true);
  });
});
