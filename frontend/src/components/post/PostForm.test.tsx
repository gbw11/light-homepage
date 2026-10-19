import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PostDetail } from "@/types/api";
import { api } from "@/lib/api";
import { isoToLocalInput } from "@/lib/viewWindow";
import { PostForm } from "./PostForm";

// 에디터(tiptap)는 이 테스트의 관심사가 아니다 — 본문은 post.body로 이미 채워져 있다
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { posts: { create: vi.fn(), update: vi.fn() }, attachments: { upload: vi.fn() } },
  };
});

const mockUpdate = vi.mocked(api.posts.update);

const BODY = { type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "본문" }] }] };

function post(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    id: "31",
    category: "MINUTES",
    title: "8월 정기 임원회의록",
    slug: "minutes-2026-08",
    body: BODY,
    pinned: false,
    authorName: "박OO",
    publishedAt: "2026-08-21T01:00:00Z",
    updatedAt: "2026-08-21T01:00:00Z",
    attachments: [],
    viewableFrom: "2026-10-19T00:00:00Z",
    viewableUntil: "2026-10-26T14:59:00Z",
    ...overrides,
  };
}

function renderForm(p: PostDetail) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PostForm post={p} />
    </QueryClientProvider>,
  );
}

describe("PostForm — 회의록·예산안 열람 기간 (§3.4 2026-10-19)", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
  });

  it("수정 화면은 받은 기간으로 폼을 채우고, 그대로 저장하면 같은 기간(UTC)을 보낸다", async () => {
    renderForm(post());

    expect(screen.getByLabelText("시작")).toHaveValue(isoToLocalInput("2026-10-19T00:00:00Z"));
    expect(screen.getByLabelText("종료")).toHaveValue(isoToLocalInput("2026-10-26T14:59:00Z"));

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      viewableFrom: "2026-10-19T00:00:00.000Z",
      viewableUntil: "2026-10-26T14:59:00.000Z",
    });
  });

  it("기간 없이 게시하면 보내지 않고 시작 칸에 알린다", async () => {
    renderForm(post({ viewableFrom: null, viewableUntil: null }));

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByText("열람 기간을 입력해주세요.")).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("종료가 시작보다 앞이면 보내지 않는다", async () => {
    renderForm(post({ viewableFrom: "2026-10-26T00:00:00Z", viewableUntil: "2026-10-19T00:00:00Z" }));

    await userEvent.setup().click(screen.getByRole("button", { name: "수정 저장" }));

    expect(await screen.findByText("열람 종료는 시작보다 뒤여야 합니다.")).toBeInTheDocument();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("임시저장은 기간을 비워 둘 수 있다", async () => {
    renderForm(post({ viewableFrom: null, viewableUntil: null }));

    await userEvent.setup().click(screen.getByRole("button", { name: "임시저장" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({
      publish: false,
      viewableFrom: null,
      viewableUntil: null,
    });
  });

  it("공지는 기간 칸이 없고, 남은 기간도 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderForm(post());

    await user.selectOptions(screen.getByLabelText("분류"), "NOTICE_MEMBER");
    expect(screen.queryByLabelText("시작")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "수정 저장" }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate.mock.calls[0][1]).toMatchObject({ viewableFrom: null, viewableUntil: null });
  });
});
