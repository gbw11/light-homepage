import { describe, expect, it } from "vitest";
import type { PostSummary } from "@/types/api";
import { sortNotices } from "./NoticeList";

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
