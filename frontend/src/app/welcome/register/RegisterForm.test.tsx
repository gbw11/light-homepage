import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/api";
import { RegisterForm } from "./RegisterForm";

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { newcomers: { submit: vi.fn() } } };
});

const mockSubmit = vi.mocked(api.newcomers.submit);

async function fillRequired(user: ReturnType<typeof userEvent.setup>, birthDigits: string) {
  await user.type(screen.getByLabelText("이름 *"), "김새벽");
  await user.type(screen.getByLabelText("연락처 *"), "010-1234-5678");
  if (birthDigits) await user.type(screen.getByLabelText("생년월일 *"), birthDigits);
  await user.click(screen.getByRole("checkbox"));
}

describe("RegisterForm — 생년월일 필수 (§9.1 2026-10-19)", () => {
  beforeEach(() => {
    mockSubmit.mockReset();
    mockSubmit.mockResolvedValue({ id: "1" });
  });

  it("숫자만 눌러도 대시가 붙고 birthDate로 보낸다 — 나이대는 보내지 않는다", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillRequired(user, "20010314");
    expect(screen.getByLabelText("생년월일 *")).toHaveValue("2001-03-14");

    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("등록됐습니다 🎉")).toBeInTheDocument();
    const sent = mockSubmit.mock.calls[0][0];
    expect(sent.birthDate).toBe("2001-03-14");
    expect(sent).not.toHaveProperty("ageGroup");
  });

  it("비우면 보내지 않고 그 칸에 알린다", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillRequired(user, "");
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("생년월일을 입력해주세요.")).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("달력에 없는 날짜는 보내기 전에 막는다", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillRequired(user, "20010230");
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("생년월일을 확인해주세요.")).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("서버가 field birthDate로 거절하면 그 칸에 서버 문구를 붙인다", async () => {
    mockSubmit.mockRejectedValue(
      new ApiError({ code: "VALIDATION_ERROR", message: "생년월일을 확인해주세요(서버).", status: 400, field: "birthDate" }),
    );
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillRequired(user, "20010314");
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("생년월일을 확인해주세요(서버).")).toBeInTheDocument();
  });
});
