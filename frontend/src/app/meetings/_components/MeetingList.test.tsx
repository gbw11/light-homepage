import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser, MeetingSummary, Role } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";
import { MeetingList } from "./MeetingList";

vi.mock("@/components/providers/AuthProvider", () => ({ useAuth: vi.fn() }));
vi.mock("@/lib/api", () => ({
  api: { meetings: { list: vi.fn() } },
  isApiError: () => false,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockList = vi.mocked(api.meetings.list);

function asUser(role: Role) {
  const user: AuthUser = { id: "u1", name: "홍길동", loginId: "hong", phone: "010-1234-5678", role };
  mockUseAuth.mockReturnValue({ user } as ReturnType<typeof useAuth>);
}

const ITEMS: MeetingSummary[] = [
  {
    id: "3",
    title: "10월 월례회",
    meetingDate: "2026-10-05",
    pageCount: 4,
    viewableFrom: "2026-10-05T11:00:00Z",
    viewableUntil: "2099-10-07T14:59:00Z",
    status: "OPEN",
  },
  {
    id: "4",
    title: "11월 월례회",
    meetingDate: "2026-11-02",
    pageCount: 4,
    viewableFrom: "2026-11-02T11:00:00Z",
    viewableUntil: "2026-11-04T14:59:00Z",
    status: "SCHEDULED",
  },
  {
    id: "2",
    title: "9월 월례회",
    meetingDate: "2026-09-07",
    pageCount: 4,
    viewableFrom: "2026-09-07T11:00:00Z",
    viewableUntil: "2026-09-09T14:59:00Z",
    status: "CLOSED",
  },
];

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MeetingList />
    </QueryClientProvider>,
  );
}

function card(title: string): HTMLElement {
  return screen.getByRole("heading", { name: title }).closest("article") as HTMLElement;
}

describe("MeetingList — 열람 버튼 색·상태", () => {
  beforeEach(() => {
    mockList.mockResolvedValue({ items: ITEMS, page: 0, size: 20, hasNext: false });
  });

  it("회원: 기간 안이면 [열람하기] 링크, 기간 밖이면 회색 비활성 버튼", async () => {
    asUser("MEMBER");
    renderList();
    await screen.findByText("10월 월례회");

    const open = card("10월 월례회").querySelector("a");
    expect(open).toHaveTextContent("열람하기");
    expect(open).toHaveAttribute("href", "/meetings/3");

    const scheduled = card("11월 월례회").querySelector("button");
    expect(scheduled).toHaveTextContent("열람 전");
    expect(scheduled).toBeDisabled();
    expect(card("11월 월례회").querySelector("a")).toBeNull();

    const closed = card("9월 월례회").querySelector("button");
    expect(closed).toHaveTextContent("열람 종료");
    expect(closed).toBeDisabled();
    expect(card("9월 월례회").querySelector("a")).toBeNull();
  });

  it.each<Role>(["LEADER", "PASTOR"])("%s: 기간 밖 자료도 [임원 열람]으로 열 수 있다", async (role) => {
    asUser(role);
    renderList();
    await screen.findByText("10월 월례회");

    expect(card("10월 월례회").querySelector("a")).toHaveTextContent("열람하기");
    for (const [title, id] of [
      ["11월 월례회", "4"],
      ["9월 월례회", "2"],
    ] as const) {
      const link = card(title).querySelector("a");
      expect(link).toHaveTextContent("임원 열람");
      expect(link).toHaveAttribute("href", `/meetings/${id}`);
      expect(card(title).querySelector("button")).toBeNull();
    }
  });
});
