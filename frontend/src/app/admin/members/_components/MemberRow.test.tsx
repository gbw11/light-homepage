import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemberRow } from "./MemberRow";
import type { AdminMember } from "@/types/api";

const mockChangeRole = vi.fn();
const mockDeleteMember = vi.fn();
const mockIssuePasswordResetCode = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      admin: {
        changeRole: (...args: unknown[]) => mockChangeRole(...args),
        deleteMember: (...args: unknown[]) => mockDeleteMember(...args),
        issuePasswordResetCode: (...args: unknown[]) => mockIssuePasswordResetCode(...args),
      },
    },
  };
});

const member: AdminMember = {
  id: "member-1",
  name: "김도연a",
  loginId: "kimdy",
  phone: "010-0000-0000",
  role: "MEMBER",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function renderMemberRow(target: AdminMember = member) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemberRow member={target} />
    </QueryClientProvider>,
  );
}

/** 인라인 삭제 패널을 열고 사유를 입력한 뒤, 패널의 삭제 버튼을 눌러 확인 모달을 띄운다 */
async function openDeleteConfirmDialog(user: ReturnType<typeof userEvent.setup>) {
  // 헤더의 "삭제" 토글 버튼 — 아직 패널이 없으므로 유일하다
  await user.click(screen.getByRole("button", { name: "삭제" }));
  await user.type(
    screen.getByLabelText("삭제 사유 (필수 — 기록에 남습니다)"),
    "본인 확인 — 선점 계정 삭제",
  );
  // 이제 "삭제" 버튼이 헤더 토글 + 패널 제출, 두 개다 — 패널(마지막) 것을 누른다
  const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
  await user.click(deleteButtons[deleteButtons.length - 1]);
  return screen.findByRole("alertdialog");
}

describe("MemberRow — 확인 모달 (LIGHT-151)", () => {
  beforeEach(() => {
    mockChangeRole.mockReset();
    mockDeleteMember.mockReset();
    mockIssuePasswordResetCode.mockReset();
  });

  it("역할 변경: 모달이 열리면 초기 포커스가 취소 버튼에 있다", async () => {
    const user = userEvent.setup();
    renderMemberRow();

    await user.selectOptions(screen.getByLabelText("김도연a 역할 변경"), "LEADER");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("역할 변경: 취소를 누르면 아무 변경도 일어나지 않는다", async () => {
    const user = userEvent.setup();
    renderMemberRow();

    const select = screen.getByLabelText("김도연a 역할 변경") as HTMLSelectElement;
    await user.selectOptions(select, "LEADER");

    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(mockChangeRole).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    // 셀렉트 값도 원래 역할(MEMBER)로 유지되어야 한다
    expect(select).toHaveValue("MEMBER");
  });

  it("역할 변경: 확인을 누르면 실제로 API가 호출된다", async () => {
    const user = userEvent.setup();
    mockChangeRole.mockResolvedValueOnce(undefined);
    renderMemberRow();

    await user.selectOptions(screen.getByLabelText("김도연a 역할 변경"), "LEADER");
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "변경" }));

    expect(mockChangeRole).toHaveBeenCalledWith("member-1", { role: "LEADER" });
  });

  it("계정 삭제: 확인 모달이 열리면 초기 포커스가 취소 버튼에 있다", async () => {
    const user = userEvent.setup();
    renderMemberRow();

    const dialog = await openDeleteConfirmDialog(user);
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveFocus();
  });

  it("계정 삭제: 확인 모달에서 취소를 누르면 삭제 API가 호출되지 않는다", async () => {
    const user = userEvent.setup();
    renderMemberRow();

    const dialog = await openDeleteConfirmDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "취소" }));

    expect(mockDeleteMember).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("계정 삭제: 확인 모달에서 삭제를 누르면 실제로 API가 호출된다", async () => {
    const user = userEvent.setup();
    mockDeleteMember.mockResolvedValueOnce(undefined);
    renderMemberRow();

    const dialog = await openDeleteConfirmDialog(user);
    await user.click(within(dialog).getByRole("button", { name: "삭제" }));

    expect(mockDeleteMember).toHaveBeenCalledWith("member-1", {
      reason: "본인 확인 — 선점 계정 삭제",
    });
  });
});

describe("MemberRow — 전도사 지정 (점검 2026-10-07 🔴-4)", () => {
  beforeEach(() => {
    mockChangeRole.mockReset();
  });

  it("임원을 전도사로 지정하면 인수인계 안내를 보여주고 PASTOR로 요청한다", async () => {
    mockChangeRole.mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderMemberRow({ ...member, role: "LEADER" });

    await user.selectOptions(screen.getByLabelText("김도연a 역할 변경"), "PASTOR");

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("새 전도사를 먼저 지정한 뒤 본인을 강등");
    await user.click(within(dialog).getByRole("button", { name: "변경" }));

    expect(mockChangeRole).toHaveBeenCalledWith("member-1", { role: "PASTOR" });
  });
});
