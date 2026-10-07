import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AuthUser, MeetingDetail } from "@/types/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { api } from "@/lib/api";
import { MeetingScreen } from "./MeetingScreen";

/**
 * LIGHT-107 — 월례회 뷰어 상태 3종 렌더 테스트.
 *
 * `MeetingScreen`(`app/meetings/[id]/_components/MeetingScreen.tsx`)이
 * `GET /api/meetings/{id}` 응답의 `status`·`canView`만 보고 분기하는
 * 실제 로직을 그대로 검증한다 (SPEC_API §7.2, `MeetingUnavailable.tsx`의
 * 주석 참고).
 *
 * 검증 대상:
 *   · SCHEDULED — "아직 열람 기간이 아닙니다" (canView: false)
 *   · OPEN      — 실제 뷰어(`MeetingViewer`)가 렌더되고 "열람 가능" 문구가 있다
 *   · CLOSED    — "열람 기간이 종료되었습니다" (canView: false)
 *
 * CLOSED는 **페이지 자체(제목·h1)는 보여주되 본문(페이지 이미지·워터마크
 * 안내)은 노출하지 않는다** — "존재는 알리되 내용은 차단"의 실제 근거는
 * 여기서 `MeetingViewer`가 전혀 렌더되지 않는다는 것으로 확인한다.
 */

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  api: {
    meetings: {
      get: vi.fn(),
      pageUrl: vi.fn((id: string, pageNo: number) => `/api/meetings/${id}/pages/${pageNo}`),
    },
  },
  isApiError: () => false,
}));

const mockUseAuth = vi.mocked(useAuth);
const mockGet = vi.mocked(api.meetings.get);

function makeUser(): AuthUser {
  return {
    id: "user-1",
    name: "홍길동",
    loginId: "hong",
    phone: "010-1234-5678",
    role: "MEMBER",
  };
}

function makeDetail(overrides: Partial<MeetingDetail>): MeetingDetail {
  return {
    id: "m-1",
    title: "9월 월례회 자료",
    meetingDate: "2026-09-01",
    pageCount: 3,
    status: "OPEN",
    viewableUntil: "2026-09-05T14:59:00Z",
    remainingSeconds: 3600,
    canView: true,
    viewReason: null,
    ...overrides,
  };
}

function renderScreen(detail: MeetingDetail) {
  mockUseAuth.mockReturnValue({
    user: makeUser(),
    isLoading: false,
    refetch: vi.fn(),
    logout: vi.fn(),
  });
  mockGet.mockResolvedValue(detail);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MeetingScreen meetingId={detail.id} />
    </QueryClientProvider>,
  );
}

describe("/meetings/[id] 상태 3종 렌더", () => {
  beforeEach(() => {
    mockUseAuth.mockReset();
    mockGet.mockReset();
  });

  it("SCHEDULED — 아직 열람 기간이 아니라는 문장을 보여주고 본문은 없다", async () => {
    renderScreen(
      makeDetail({ status: "SCHEDULED", canView: false, viewReason: "PERIOD_CLOSED" }),
    );

    expect(
      await screen.findByRole("heading", { name: "아직 열람 기간이 아닙니다" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "열람 기간이 종료되었습니다" }),
    ).not.toBeInTheDocument();
    // 본문(페이지 이미지)은 어떤 상태 문구로도 나오지 않는다
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("OPEN — 실제 뷰어가 렌더되고 열람 가능 상태가 드러난다", async () => {
    renderScreen(makeDetail({ status: "OPEN", canView: true, remainingSeconds: 120 }));

    expect(await screen.findByRole("heading", { name: "9월 월례회 자료" })).toBeInTheDocument();
    // MeetingUnavailable 쪽 문구는 전혀 없어야 한다
    expect(
      screen.queryByRole("heading", { name: "아직 열람 기간이 아닙니다" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "열람 기간이 종료되었습니다" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("CLOSED — 열람 기간 종료 문장만 보이고 자료 내용(본문·이미지)은 차단된다", async () => {
    renderScreen(
      makeDetail({
        status: "CLOSED",
        canView: false,
        viewReason: "PERIOD_CLOSED",
        viewableUntil: "2026-08-30T14:59:00Z",
        title: "8월 월례회 자료",
      }),
    );

    expect(
      await screen.findByRole("heading", { name: "열람 기간이 종료되었습니다" }),
    ).toBeInTheDocument();
    // 존재는 알린다 — 제목은 노출된다
    expect(screen.getByText("8월 월례회 자료")).toBeInTheDocument();
    // 내용은 차단된다 — 페이지 이미지(본문)는 렌더되지 않는다
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "아직 열람 기간이 아닙니다" }),
    ).not.toBeInTheDocument();
  });
});
