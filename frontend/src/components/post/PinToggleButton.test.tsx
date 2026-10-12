import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, PostDetail, Role } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";
import { PinToggleButton } from "./PinToggleButton";

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { posts: { update: vi.fn(), getForEdit: vi.fn() } },
  isApiError: () => false,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockUpdate = vi.mocked(api.posts.update);
const mockGetForEdit = vi.mocked(api.posts.getForEdit);

function user(role: Role): AuthUser {
  return { id: "u1", name: "홍길동", loginId: "hong", phone: "010-1234-5678", role };
}

function notice(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    id: "18",
    category: "NOTICE_PUBLIC",
    title: "여름 수련회 신청 안내",
    slug: "summer-retreat-2026",
    body: { type: "doc", content: [] },
    pinned: true,
    authorName: "박OO",
    publishedAt: "2026-07-01T01:00:00Z",
    updatedAt: "2026-07-01T01:00:00Z",
    attachments: [
      { id: "7", filename: "신청서.xlsx", contentType: "application/octet-stream", sizeBytes: 10 },
    ],
    ...overrides,
  };
}

function renderButton(post: PostDetail, latest: PostDetail = post) {
  // 누르는 순간 서버에서 새로 받는 글 — 기본은 화면과 같은 내용
  mockGetForEdit.mockResolvedValue(latest);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PinToggleButton post={post} />
    </QueryClientProvider>,
  );
}

function asUser(role: Role) {
  mockUseAuth.mockReturnValue({ user: user(role) } as ReturnType<typeof useAuth>);
}

describe("PinToggleButton", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
    mockGetForEdit.mockReset();
  });

  it("일반 회원에게는 보이지 않는다", () => {
    asUser("MEMBER");
    const { container } = renderButton(notice());
    expect(container).toBeEmptyDOMElement();
  });

  it("임원은 고정을 해제할 수 있고, 내용은 그대로 pinned만 바꿔 보낸다", async () => {
    asUser("LEADER");
    renderButton(notice());

    fireEvent.click(screen.getByRole("button", { name: /고정 해제/ }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockUpdate).toHaveBeenCalledWith("18", {
      category: "NOTICE_PUBLIC",
      title: "여름 수련회 신청 안내",
      body: { type: "doc", content: [] },
      pinned: false,
      attachmentIds: ["7"],
      // 게시된 글은 게시 상태로 다시 저장한다 — false면 임시저장으로 내려간다
      publish: true,
    });
    expect(await screen.findByRole("button", { name: /상단 고정/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("고정을 해제했습니다");
  });

  it("전도사는 고정되지 않은 글을 상단에 고정할 수 있다", async () => {
    asUser("PASTOR");
    renderButton(notice({ pinned: false }));

    fireEvent.click(screen.getByRole("button", { name: /상단 고정/ }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1].pinned).toBe(true);
    expect(await screen.findByRole("button", { name: /고정 해제/ })).toBeInTheDocument();
  });

  it("임시저장 글은 임시저장 상태를 유지한다", async () => {
    asUser("LEADER");
    renderButton(notice({ publishedAt: null }));

    fireEvent.click(screen.getByRole("button", { name: /고정 해제/ }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
    expect(mockUpdate.mock.calls[0][1].publish).toBe(false);
  });

  it("화면이 캐시된 옛 내용이어도 누르는 순간 받은 최신 글을 보낸다 (🟠-11)", async () => {
    asUser("LEADER");
    const stale = notice();
    const latest = notice({
      title: "여름 수련회 신청 안내 (장소 변경)",
      body: { type: "doc", content: [{ type: "paragraph" }] },
      attachments: [
        { id: "9", filename: "신청서_v2.xlsx", contentType: "application/octet-stream", sizeBytes: 12 },
      ],
    });
    renderButton(stale, latest);

    fireEvent.click(screen.getByRole("button", { name: /고정 해제/ }));

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
    expect(mockGetForEdit).toHaveBeenCalledWith("18");
    expect(mockUpdate).toHaveBeenCalledWith("18", {
      category: "NOTICE_PUBLIC",
      title: "여름 수련회 신청 안내 (장소 변경)",
      body: { type: "doc", content: [{ type: "paragraph" }] },
      pinned: false,
      attachmentIds: ["9"],
      publish: true,
    });
  });

  it("최신 글을 받지 못하면 저장하지 않고 안내한다", async () => {
    asUser("LEADER");
    renderButton(notice());
    mockGetForEdit.mockRejectedValue(new Error("network"));

    fireEvent.click(screen.getByRole("button", { name: /고정 해제/ }));

    expect(await screen.findByRole("status")).toHaveTextContent("변경하지 못했습니다");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
