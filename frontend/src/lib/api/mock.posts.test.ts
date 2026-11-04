import { afterEach, describe, expect, it } from "vitest";
import type { AuthUser, PostInput } from "@/types/api";
import { mockApi } from "./mock";

/**
 * mock이 실서버의 회의록·예산안 열람 기간 규칙(SPEC_API §3.1~§3.5, 2026-10-19)을 따르는가.
 * mock이 서버보다 느슨하면 화면이 403·400을 다루는지 mock에서 확인할 수 없다.
 *
 * mock 데이터: 회의록 31(기간 안) · 30(기간 끝) · 예산안 32(기간 없음)
 */
const MEMBER: AuthUser = { id: "42", name: "김도연a", loginId: "doyeon01", phone: "010-1111-2222", role: "MEMBER" };
const LEADER: AuthUser = { id: "7", name: "박임원", loginId: "leader1", phone: "010-9999-0000", role: "LEADER" };
const PASTOR: AuthUser = { id: "1", name: "최전도", loginId: "pastor1", phone: "010-7777-8888", role: "PASTOR" };

function as(user: AuthUser) {
  window.localStorage.setItem("light-mock-session", JSON.stringify(user));
}

async function failureOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const err = e as { code: string; field?: string | null; message: string };
    return { code: err.code, field: err.field ?? null, message: err.message };
  }
  throw new Error("성공하면 안 된다");
}

const MINUTES_INPUT: PostInput = {
  category: "MINUTES",
  title: "10월 임원회의록",
  body: { type: "doc", content: [{ type: "paragraph" }] },
  pinned: false,
  attachmentIds: [],
  publish: true,
  viewableFrom: "2026-10-19T00:00:00Z",
  viewableUntil: "2026-10-26T14:59:00Z",
};

afterEach(() => window.localStorage.removeItem("light-mock-session"));

describe("mock posts — 열람 기간", () => {
  it("목록에 기간 밖 글도 남고, canView·status로 잠금을 알린다", async () => {
    as(MEMBER);
    const { items } = await mockApi.posts.list({ category: "MINUTES" });
    const byId = new Map(items.map((p) => [p.id, p]));

    expect(byId.get("31")).toMatchObject({ status: "OPEN", canView: true });
    expect(byId.get("30")).toMatchObject({ status: "CLOSED", canView: false });
  });

  it("공지는 status null · canView true", async () => {
    const { items } = await mockApi.posts.list({ category: "NOTICE_PUBLIC" });
    expect(items[0]).toMatchObject({ viewableFrom: null, status: null, canView: true });
  });

  it("회원은 기간 밖 상세가 403 「열람 기간이 아닙니다.」", async () => {
    as(MEMBER);
    expect(await failureOf(mockApi.posts.get("30"))).toMatchObject({
      code: "FORBIDDEN",
      message: "열람 기간이 아닙니다.",
    });
    await expect(mockApi.posts.get("31")).resolves.toMatchObject({ id: "31" });
  });

  it("임원도 기간을 따른다 — 기간 없는 예산안은 403 (월례회와 다름)", async () => {
    as(LEADER);
    expect((await failureOf(mockApi.posts.get("32"))).code).toBe("FORBIDDEN");
    expect((await failureOf(mockApi.posts.getForEdit("32"))).code).toBe("FORBIDDEN");
  });

  it("전도사는 기간 밖도 연다", async () => {
    as(PASTOR);
    await expect(mockApi.posts.get("32")).resolves.toMatchObject({ viewableFrom: null });
    const { items } = await mockApi.posts.list({ category: "BUDGET" });
    expect(items.every((p) => p.canView)).toBe(true);
  });

  it("예산안 × 회원은 지금처럼 404 (분류 권한 단계)", async () => {
    as(MEMBER);
    expect((await failureOf(mockApi.posts.get("33"))).code).toBe("NOT_FOUND");
  });

  it("회의록 게시에 기간이 없으면 400 field viewableFrom, 끝 ≤ 시작이면 field viewableUntil", async () => {
    as(LEADER);
    expect(
      await failureOf(mockApi.posts.create({ ...MINUTES_INPUT, viewableFrom: null, viewableUntil: null })),
    ).toMatchObject({ code: "VALIDATION_ERROR", field: "viewableFrom" });
    expect(
      await failureOf(
        mockApi.posts.create({ ...MINUTES_INPUT, viewableUntil: MINUTES_INPUT.viewableFrom }),
      ),
    ).toMatchObject({ code: "VALIDATION_ERROR", field: "viewableUntil" });
  });

  it("임시저장은 기간을 비울 수 있고, 공지는 기간을 무시한다", async () => {
    as(LEADER);
    await expect(
      mockApi.posts.create({ ...MINUTES_INPUT, publish: false, viewableFrom: null, viewableUntil: null }),
    ).resolves.toHaveProperty("id");

    const { id } = await mockApi.posts.create({ ...MINUTES_INPUT, category: "NOTICE_PUBLIC" });
    await expect(mockApi.posts.getForEdit(id)).resolves.toMatchObject({
      viewableFrom: null,
      viewableUntil: null,
    });
  });

  it("기간 밖 글 수정은 전도사·글쓴이만 — 다른 임원은 403", async () => {
    as(LEADER);
    expect((await failureOf(mockApi.posts.update("30", MINUTES_INPUT))).code).toBe("FORBIDDEN");
    as(PASTOR);
    await expect(mockApi.posts.update("30", MINUTES_INPUT)).resolves.toBeUndefined();
  });
});
