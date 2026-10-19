import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/error";
import { DocumentDetail } from "./DocumentDetail";

vi.mock("@/components/post/EditPostLink", () => ({ EditPostLink: () => null }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, api: { posts: { get: vi.fn() }, attachments: { downloadUrl: vi.fn() } } };
});

const mockGet = vi.mocked(api.posts.get);

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DocumentDetail slug="minutes-2026-07" />
    </QueryClientProvider>,
  );
}

describe("DocumentDetail — 실패 구분 (§3.1 · §3.3 2026-10-19)", () => {
  beforeEach(() => mockGet.mockReset());

  it("403은 '권한 없음'이 아니라 열람 기간이 아니라고 알린다", async () => {
    mockGet.mockRejectedValueOnce(
      new ApiError({ code: "FORBIDDEN", message: "열람 기간이 아닙니다.", status: 403 }),
    );
    renderDetail();

    expect(await screen.findByRole("heading", { name: "열람 기간이 아닙니다" })).toBeInTheDocument();
    expect(screen.queryByText("찾을 수 없는 문서입니다.")).not.toBeInTheDocument();
  });

  it("404는 지금처럼 존재를 숨긴다", async () => {
    mockGet.mockRejectedValueOnce(new ApiError({ code: "NOT_FOUND", message: "x", status: 404 }));
    renderDetail();

    expect(await screen.findByText("찾을 수 없는 문서입니다.")).toBeInTheDocument();
  });
});
