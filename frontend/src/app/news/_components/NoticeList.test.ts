import { describe, expect, it } from "vitest";
import type { PostSummary } from "@/types/api";
import { mergeNoticeStreams, sortNotices } from "./NoticeList";

function post(id: string, pinned: boolean, publishedAt: string | null): PostSummary {
  return {
    id,
    category: "NOTICE_PUBLIC",
    title: `공지 ${id}`,
    slug: `notice-${id}`,
    pinned,
    authorName: "임원",
    publishedAt,
    attachmentCount: 0,
  };
}

describe("sortNotices — 공개·회원 공지를 합친 목록 정렬", () => {
  it("고정 글은 날짜와 상관없이 위로 온다", () => {
    const sorted = sortNotices([
      post("new", false, "2026-10-05T00:00:00Z"),
      post("old-pinned", true, "2026-07-01T00:00:00Z"),
      post("mid", false, "2026-09-01T00:00:00Z"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["old-pinned", "new", "mid"]);
  });

  it("고정 글끼리, 일반 글끼리는 최신순이다", () => {
    const sorted = sortNotices([
      post("p-old", true, "2026-07-01T00:00:00Z"),
      post("n-old", false, "2026-08-01T00:00:00Z"),
      post("p-new", true, "2026-09-01T00:00:00Z"),
      post("n-new", false, "2026-10-01T00:00:00Z"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["p-new", "p-old", "n-new", "n-old"]);
  });

  it("고정을 해제한 글은 원래 날짜 자리로 돌아간다", () => {
    const sorted = sortNotices([
      post("retreat", false, "2026-07-01T00:00:00Z"),
      post("newer", false, "2026-09-01T00:00:00Z"),
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["newer", "retreat"]);
  });

  it("임시저장(publishedAt null)은 맨 뒤", () => {
    const sorted = sortNotices([post("draft", false, null), post("a", false, "2026-09-01T00:00:00Z")]);
    expect(sorted.map((p) => p.id)).toEqual(["a", "draft"]);
  });
});

describe("mergeNoticeStreams — 따로 페이지를 넘기는 공개·회원 공지 합치기 (점검 🟠-5)", () => {
  const day = (d: number) => `2026-09-${String(d).padStart(2, "0")}T00:00:00Z`;

  it("둘 다 끝까지 불러왔으면 전부 정렬해서 보여준다", () => {
    const { visible, next } = mergeNoticeStreams([
      { items: [post("p20", false, day(20)), post("p10", false, day(10))], hasNext: false },
      { items: [post("m15", false, day(15))], hasNext: false },
    ]);
    expect(visible.map((p) => p.id)).toEqual(["p20", "m15", "p10"]);
    expect(next).toBeNull();
  });

  it("뒤가 남은 분류의 마지막 글보다 오래된 글은 보류한다 — 나중에 중간에 끼어들지 않게", () => {
    // 공개 공지는 9/20·9/18까지 받았고 더 있다(9/17이 다음 페이지에 있을 수 있다).
    // 회원 공지 9/12는 지금 보이면, 공개 공지 9/17이 나중에 그 위로 끼어든다.
    const { visible, next } = mergeNoticeStreams([
      { items: [post("p20", false, day(20)), post("p18", false, day(18))], hasNext: true },
      { items: [post("m19", false, day(19)), post("m12", false, day(12))], hasNext: false },
    ]);
    expect(visible.map((p) => p.id)).toEqual(["p20", "m19", "p18"]);
    expect(next).toBe(0);
  });

  it("더 보기는 보류를 만드는 쪽(마지막 글이 더 위인 분류)을 불러온다", () => {
    const { next } = mergeNoticeStreams([
      { items: [post("p20", false, day(20)), post("p05", false, day(5))], hasNext: true },
      { items: [post("m19", false, day(19)), post("m15", false, day(15))], hasNext: true },
    ]);
    expect(next).toBe(1);
  });

  it("다음 페이지를 받으면 이미 보인 순서는 그대로, 아래로만 늘어난다", () => {
    const before = mergeNoticeStreams([
      { items: [post("p20", false, day(20)), post("p18", false, day(18))], hasNext: true },
      { items: [post("m19", false, day(19)), post("m12", false, day(12))], hasNext: false },
    ]).visible.map((p) => p.id);
    const after = mergeNoticeStreams([
      {
        items: [
          post("p20", false, day(20)),
          post("p18", false, day(18)),
          post("p17", false, day(17)),
          post("p01", false, day(1)),
        ],
        hasNext: false,
      },
      { items: [post("m19", false, day(19)), post("m12", false, day(12))], hasNext: false },
    ]).visible.map((p) => p.id);
    expect(after.slice(0, before.length)).toEqual(before);
    expect(after).toEqual(["p20", "m19", "p18", "p17", "m12", "p01"]);
  });

  it("고정 글은 페이지와 상관없이 위", () => {
    const { visible } = mergeNoticeStreams([
      { items: [post("p20", false, day(20))], hasNext: true },
      { items: [post("m-pin", true, day(1))], hasNext: false },
    ]);
    expect(visible.map((p) => p.id)).toEqual(["m-pin", "p20"]);
  });
});
