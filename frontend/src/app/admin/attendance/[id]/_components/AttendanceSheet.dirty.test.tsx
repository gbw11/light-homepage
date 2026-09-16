import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AttendanceSheet } from "./AttendanceSheet";
import { ApiError } from "@/lib/api/error";
import type { AttendanceSessionDetail } from "@/types/api";

const mockSession = vi.fn();
const mockSaveEntries = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      attendance: {
        session: (...args: unknown[]) => mockSession(...args),
        saveEntries: (...args: unknown[]) => mockSaveEntries(...args),
      },
    },
  };
});

function renderSheet() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AttendanceSheet sessionId="s1" />
    </QueryClientProvider>,
  );
}

const detail: AttendanceSessionDetail = {
  id: "s1",
  date: "2026-09-13",
  type: "SUNDAY_SERVICE",
  title: "주일예배",
  entries: [{ rosterId: "r1", name: "홍길동", village: "1", status: null }],
};

/**
 * LIGHT-136 — 실제 구현 위치는 회원 관리 화면이 아니라 출석 체크 시트
 * (`AttendanceSheet`)다. "미저장" 표시·초기화 로직은 이 컴포넌트의
 * `draft`(rosterId → 상태) state에 있다. `MemberBoard`/`MemberRow`는
 * 역할 변경을 즉시 뮤테이션으로 저장하는 구조라 별도의 draft/dirty 로직이
 * 없다.
 */
describe("AttendanceSheet — 미저장 표시·저장 후 초기화 (LIGHT-136)", () => {
  beforeEach(() => {
    mockSession.mockReset();
    mockSaveEntries.mockReset();
  });

  it("상태를 바꾸면 이름 옆에 미저장 점이 뜨고 하단 카운트가 늘어난다", async () => {
    const user = userEvent.setup();
    mockSession.mockResolvedValueOnce(detail);
    renderSheet();

    expect(await screen.findByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("바뀐 것이 없습니다")).toBeInTheDocument();
    expect(screen.queryByLabelText("저장 안 됨")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "출석" }));

    expect(screen.getByLabelText("저장 안 됨")).toBeInTheDocument();
    expect(screen.getByText("저장 안 된 체크 1건")).toBeInTheDocument();
  });

  it("저장 성공 후에는 미저장 점과 카운트가 모두 사라진다", async () => {
    const user = userEvent.setup();
    // 저장 성공 시 invalidateQueries로 재조회가 한 번 더 나간다
    mockSession.mockResolvedValue(detail);
    mockSaveEntries.mockResolvedValueOnce(undefined);
    renderSheet();

    await screen.findByText("홍길동");
    await user.click(screen.getByRole("button", { name: "출석" }));
    expect(screen.getByLabelText("저장 안 됨")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(screen.getByText("저장됐습니다")).toBeInTheDocument());
    expect(screen.queryByLabelText("저장 안 됨")).not.toBeInTheDocument();
    expect(screen.queryByText(/저장 안 된 체크/)).not.toBeInTheDocument();
    expect(mockSaveEntries).toHaveBeenCalledWith("s1", [{ rosterId: "r1", status: "PRESENT" }]);
  });

  it("저장 실패 시에는 미저장 점과 카운트가 그대로 남아있는다", async () => {
    const user = userEvent.setup();
    mockSession.mockResolvedValueOnce(detail);
    mockSaveEntries.mockRejectedValueOnce(
      new ApiError({ code: "VALIDATION_ERROR", message: "저장할 수 없습니다.", status: 400 }),
    );
    renderSheet();

    await screen.findByText("홍길동");
    await user.click(screen.getByRole("button", { name: "출석" }));
    await user.click(screen.getByRole("button", { name: "저장" }));

    expect(await screen.findByText("저장할 수 없습니다.")).toBeInTheDocument();
    // 실패해도 draft(미저장분)가 지워지지 않는다 — 점 표시가 남고, 저장 버튼도 계속 활성 상태다
    expect(screen.getByLabelText("저장 안 됨")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });
});
