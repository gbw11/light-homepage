import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminNotificationsResponse, AuthUser, Role } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";
import { NotificationBell } from "./NotificationBell";

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { admin: { notifications: vi.fn(), markNotificationsRead: vi.fn() } },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockList = vi.mocked(api.admin.notifications);
const mockRead = vi.mocked(api.admin.markNotificationsRead);

function asUser(role: Role) {
  const user: AuthUser = { id: "u1", name: "홍길동", loginId: "hong", phone: "010-1234-5678", role };
  mockUseAuth.mockReturnValue({ user } as ReturnType<typeof useAuth>);
}

/** SPEC_API §14.1 응답 그대로 — 실서버 모양 */
const RESPONSE: AdminNotificationsResponse = {
  unreadCount: 1,
  hasMore: false,
  readMarker: "2026-10-05T04:00:00Z",
  items: [
    { type: "NEWCOMER", refId: "14", subject: "김OO", createdAt: "2026-10-05T04:00:00Z" },
    { type: "NEWCOMER", refId: "13", subject: "박OO", createdAt: "2026-10-01T04:00:00Z" },
  ],
};

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>,
  );
}

describe("NotificationBell — §14.1 실서버 응답 (점검 🔴-3)", () => {
  beforeEach(() => {
    mockList.mockReset();
    mockRead.mockReset();
    mockList.mockResolvedValue(RESPONSE);
    mockRead.mockResolvedValue(undefined);
  });

  it("type으로 문구를 만들고 refId로 그 신청에 링크한다 — 빈 줄이 아니다", async () => {
    asUser("LEADER");
    renderBell();

    fireEvent.click(await screen.findByRole("button", { name: "알림 (안 읽음 1건)" }));

    const first = screen.getByRole("link", { name: /새가족 김OO님이 등록했습니다/ });
    expect(first).toHaveAttribute("href", "/admin/newcomers#newcomer-14");
    expect(screen.getByRole("link", { name: /새가족 박OO님이 등록했습니다/ })).toHaveAttribute(
      "href",
      "/admin/newcomers#newcomer-13",
    );
  });

  it("앞에서부터 unreadCount개만 안 읽음(굵게)으로 그린다", async () => {
    asUser("LEADER");
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "알림 (안 읽음 1건)" }));

    expect(screen.getByRole("link", { name: /김OO/ }).className).toContain("font-bold");
    expect(screen.getByRole("link", { name: /박OO/ }).className).not.toContain("font-bold");
  });

  it("열면 readMarker를 그대로 until로 보낸다", async () => {
    asUser("PASTOR");
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "알림 (안 읽음 1건)" }));

    await waitFor(() => expect(mockRead).toHaveBeenCalledWith({ until: "2026-10-05T04:00:00Z" }));
  });

  it("안 읽은 것이 없으면(readMarker null) 읽음 요청을 보내지 않는다", async () => {
    mockList.mockResolvedValue({ ...RESPONSE, unreadCount: 0, readMarker: null });
    asUser("LEADER");
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "알림" }));

    expect(mockRead).not.toHaveBeenCalled();
  });

  it("20건을 넘으면(hasMore) 잘렸다고 알린다", async () => {
    mockList.mockResolvedValue({ ...RESPONSE, hasMore: true });
    asUser("LEADER");
    renderBell();
    fireEvent.click(await screen.findByRole("button", { name: "알림 (안 읽음 1건)" }));

    expect(screen.getByText(/최근 20건만 보입니다/)).toBeInTheDocument();
  });

  it("일반 회원에게는 그리지도 부르지도 않는다", () => {
    asUser("MEMBER");
    const { container } = renderBell();
    expect(container).toBeEmptyDOMElement();
    expect(mockList).not.toHaveBeenCalled();
  });
});
