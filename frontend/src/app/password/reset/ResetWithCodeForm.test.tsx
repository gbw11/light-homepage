import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResetWithCodeForm } from "./ResetWithCodeForm";

/** USERFLOW_AUDIT 2026-10-07 🔵-14 — 리셋 코드는 하이픈·대소문자를 강제하지 않는다 */

const mockReset = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: { auth: { resetPasswordWithCode: (...args: unknown[]) => mockReset(...args) } },
  };
});

async function submit(code: string) {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ResetWithCodeForm />
    </QueryClientProvider>,
  );
  await user.type(screen.getByLabelText("아이디"), "doyeon01");
  await user.type(screen.getByLabelText("재설정 코드"), code);
  await user.type(screen.getByLabelText("새 비밀번호"), "newpass1234!");
  await user.type(screen.getByLabelText("새 비밀번호 확인"), "newpass1234!");
  await user.click(screen.getByRole("button", { name: "변경하기" }));
}

describe("ResetWithCodeForm 코드 입력", () => {
  beforeEach(() => {
    mockReset.mockReset();
    mockReset.mockResolvedValue(undefined);
  });

  it.each(["8h2k9qx3", "8H2K-9QX3", "8h2k 9qx3"])("%s 도 받아서 서버로 보낸다", async (code) => {
    await submit(code);
    await waitFor(() => expect(mockReset).toHaveBeenCalled());
    expect(mockReset.mock.calls[0][0]).toMatchObject({ loginId: "doyeon01", resetCode: code });
  });

  it("영숫자가 8자가 아니면 보내기 전에 알려준다", async () => {
    await submit("8H2K-9QX");
    expect(await screen.findByText("재설정 코드 8자리를 입력해주세요.")).toBeInTheDocument();
    expect(mockReset).not.toHaveBeenCalled();
  });
});
