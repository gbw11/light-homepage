import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AttendanceSheet } from "./AttendanceSheet";
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

/**
 * LIGHT-137 — 실제 구현 위치는 회원 관리 화면(`MemberBoard`/`MemberRow`)이
 * 아니라 출석 체크 시트(`AttendanceSheet`)다. `MemberBoard`는 마을별 그룹핑을
 * 하지 않는 평평한 목록이고, "1~9마을 + 새가족"으로 묶고 빈 마을은 렌더하지
 * 않는 로직은 이 파일의 `groups`(§84)에만 있다.
 */
describe("AttendanceSheet — 마을 그룹 렌더 (LIGHT-137)", () => {
  beforeEach(() => {
    mockSession.mockReset();
    mockSaveEntries.mockReset();
  });

  it("데이터에 있는 마을(1, 3, 새가족)만 그룹 제목으로 렌더한다 — 없는 마을(2 등)은 렌더하지 않는다", async () => {
    const detail: AttendanceSessionDetail = {
      id: "s1",
      date: "2026-09-13",
      type: "SUNDAY_SERVICE",
      title: "주일예배",
      entries: [
        { rosterId: "r1", name: "김일마을", village: "1", status: null },
        { rosterId: "r2", name: "박삼마을", village: "3", status: "PRESENT" },
        { rosterId: "r3", name: "이새가족", village: "newcomer", status: null },
      ],
    };
    mockSession.mockResolvedValueOnce(detail);
    renderSheet();

    expect(await screen.findByRole("heading", { name: "1마을" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "3마을" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "새가족" })).toBeInTheDocument();

    // 데이터에 없는 마을은 애초에 그룹이 만들어지지 않으므로 제목도 없어야 한다
    for (const n of ["2", "4", "5", "6", "7", "8", "9"]) {
      expect(screen.queryByRole("heading", { name: `${n}마을` })).not.toBeInTheDocument();
    }

    // 각 그룹 안에 해당 인원이 들어간다
    expect(screen.getByText("김일마을")).toBeInTheDocument();
    expect(screen.getByText("박삼마을")).toBeInTheDocument();
    expect(screen.getByText("이새가족")).toBeInTheDocument();
  });

  it("마을이 배정되지 않은(null) 인원은 '마을 미배정'으로 묶인다", async () => {
    const detail: AttendanceSessionDetail = {
      id: "s1",
      date: "2026-09-13",
      type: "SUNDAY_SERVICE",
      title: "주일예배",
      entries: [{ rosterId: "r1", name: "무배정", village: null, status: null }],
    };
    mockSession.mockResolvedValueOnce(detail);
    renderSheet();

    expect(await screen.findByRole("heading", { name: "마을 미배정" })).toBeInTheDocument();
  });

  it("명단이 비어 있으면 마을 그룹이 하나도 렌더되지 않는다", async () => {
    const detail: AttendanceSessionDetail = {
      id: "s1",
      date: "2026-09-13",
      type: "SUNDAY_SERVICE",
      title: "주일예배",
      entries: [],
    };
    mockSession.mockResolvedValueOnce(detail);
    renderSheet();

    await screen.findByText(/주일예배/);
    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });
});
