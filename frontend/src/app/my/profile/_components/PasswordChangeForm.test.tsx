import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/error";
import { api } from "@/lib/api";
import { PasswordChangeForm } from "./PasswordChangeForm";

vi.mock("@/lib/api", async () => {
  const { ApiError: RealApiError } = await import("@/lib/api/error");
  return {
    api: { auth: { changePassword: vi.fn() } },
    isApiError: (e: unknown) => e instanceof RealApiError,
  };
});

const mockChange = vi.mocked(api.auth.changePassword);

function renderForm() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <PasswordChangeForm />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: /비밀번호 변경/ }));
}

function fill(current: string, next: string, confirm = next) {
  fireEvent.change(screen.getByLabelText("현재 비밀번호"), { target: { value: current } });
  fireEvent.change(screen.getByLabelText("새 비밀번호"), { target: { value: next } });
  fireEvent.change(screen.getByLabelText("새 비밀번호 확인"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "비밀번호 변경" }));
}

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

describe("PasswordChangeForm — 현재 비밀번호가 틀렸을 때 (점검 🔴-1)", () => {
  beforeEach(() => {
    mockChange.mockReset();
  });

  it("실서버 응답(field: password)이면 오류 문구를 띄우고 세 칸을 모두 비운다", async () => {
    mockChange.mockRejectedValue(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "비밀번호가 올바르지 않습니다.",
        status: 400,
        field: "password",
      }),
    );
    renderForm();
    fill("wrong-pass1!", "newpass12!");

    expect(await screen.findByText(/현재 비밀번호가 올바르지 않습니다/)).toBeInTheDocument();
    expect(field("현재 비밀번호").value).toBe("");
    expect(field("새 비밀번호").value).toBe("");
    expect(field("새 비밀번호 확인").value).toBe("");
    await waitFor(() => expect(field("현재 비밀번호")).toHaveFocus());
  });

  it("그릴 칸이 없는 field의 오류도 폼 상단에 보인다 — 조용히 사라지지 않는다", async () => {
    mockChange.mockRejectedValue(
      new ApiError({ code: "VALIDATION_ERROR", message: "알 수 없는 오류", status: 400, field: "somethingElse" }),
    );
    renderForm();
    fill("pass1234!", "newpass12!");

    expect(await screen.findByText("알 수 없는 오류")).toBeInTheDocument();
    expect(field("현재 비밀번호").value).toBe("");
  });

  it("성공하면 완료 문구", async () => {
    mockChange.mockResolvedValue(undefined);
    renderForm();
    fill("pass1234!", "newpass12!");

    await waitFor(() => expect(mockChange).toHaveBeenCalledWith({
      currentPassword: "pass1234!",
      newPassword: "newpass12!",
    }));
    expect(await screen.findByText("비밀번호가 변경되었습니다.")).toBeInTheDocument();
  });
});
