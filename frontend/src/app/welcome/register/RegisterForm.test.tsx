import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterForm } from "./RegisterForm";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/error";

// api.newcomers.submit을 모킹해 실제 네트워크 호출 없이 성공/실패 시나리오를 재현한다.
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      ...actual.api,
      newcomers: {
        ...actual.api.newcomers,
        submit: vi.fn(),
      },
    },
  };
});

function renderForm() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterForm />
    </QueryClientProvider>,
  );
}

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  birthDigits = "20010314",
) {
  await user.type(screen.getByLabelText("이름 *"), "홍길동");
  await user.type(screen.getByLabelText("연락처 *"), "010-1234-5678");
  if (birthDigits) await user.type(screen.getByLabelText("생년월일 *"), birthDigits);
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.mocked(api.newcomers.submit).mockReset();
  });

  it("동의 체크박스를 체크하지 않으면 제출 버튼이 비활성화되고, 체크하면 활성화된다", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);

    const submitButton = screen.getByRole("button", { name: "등록하기" });
    expect(submitButton).toBeDisabled();

    const agreeCheckbox = screen.getByRole("checkbox");
    await user.click(agreeCheckbox);

    expect(submitButton).toBeEnabled();
  });

  it("필수 필드를 비워두고 제출하면 Zod 스키마의 에러 메시지가 표시된다", async () => {
    const user = userEvent.setup();
    renderForm();

    // 필수 필드는 비워둔 채 동의만 체크하고 제출을 시도한다.
    await user.click(screen.getByRole("checkbox"));

    const submitButton = screen.getByRole("button", { name: "등록하기" });
    await user.click(submitButton);

    expect(await screen.findByText("이름을 입력해주세요.")).toBeInTheDocument();
    expect(screen.getByText("연락처를 입력해주세요.")).toBeInTheDocument();
    expect(screen.getByText("생년월일을 입력해주세요.")).toBeInTheDocument();
    expect(api.newcomers.submit).not.toHaveBeenCalled();
  });

  it("서버 에러의 field가 폼 필드와 일치하면 해당 필드에 에러 메시지가 표시된다", async () => {
    vi.mocked(api.newcomers.submit).mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "이미 등록된 연락처입니다.",
        field: "phone",
      }),
    );

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(
      await screen.findByText("이미 등록된 연락처입니다."),
    ).toBeInTheDocument();
  });

  it("서버 에러에 일치하는 field가 없으면 공통 에러 메시지가 표시된다", async () => {
    vi.mocked(api.newcomers.submit).mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "요청을 처리할 수 없습니다.",
        field: null,
      }),
    );

    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(
      await screen.findByText("요청을 처리할 수 없습니다."),
    ).toBeInTheDocument();
  });
});

describe("RegisterForm — 생년월일 필수 (§9.1 2026-10-19)", () => {
  beforeEach(() => {
    vi.mocked(api.newcomers.submit).mockReset();
    vi.mocked(api.newcomers.submit).mockResolvedValue({ id: "1" });
  });

  it("숫자만 눌러도 대시가 붙고 birthDate로 보낸다 — 나이대는 보내지 않는다", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user, "20010314");
    expect(screen.getByLabelText("생년월일 *")).toHaveValue("2001-03-14");

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("등록됐습니다 🎉")).toBeInTheDocument();
    const sent = vi.mocked(api.newcomers.submit).mock.calls[0][0];
    expect(sent.birthDate).toBe("2001-03-14");
    expect(sent).not.toHaveProperty("ageGroup");
  });

  it("달력에 없는 날짜는 보내기 전에 막는다", async () => {
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user, "20010230");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("생년월일을 확인해주세요.")).toBeInTheDocument();
    expect(api.newcomers.submit).not.toHaveBeenCalled();
  });

  it("서버가 field birthDate로 거절하면 그 칸에 서버 문구를 붙인다", async () => {
    vi.mocked(api.newcomers.submit).mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "생년월일을 확인해주세요(서버).",
        field: "birthDate",
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await fillRequiredFields(user);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "등록하기" }));

    expect(await screen.findByText("생년월일을 확인해주세요(서버).")).toBeInTheDocument();
  });
});
