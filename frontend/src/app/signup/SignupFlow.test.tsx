import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { SignupFlow } from "./SignupFlow";
import { ApiError } from "@/lib/api/error";

const mockVerifyRoster = vi.fn();
const mockRegister = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      auth: {
        verifyRoster: (...args: unknown[]) => mockVerifyRoster(...args),
        register: (...args: unknown[]) => mockRegister(...args),
      },
    },
  };
});

function renderSignupFlow() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <SignupFlow />
    </QueryClientProvider>,
  );
}

async function fillVerifyStep(
  user: ReturnType<typeof userEvent.setup>,
  values: { name?: string; birthDate?: string; phone?: string } = {},
) {
  const { name = "김도연", birthDate = "2001-03-14", phone = "010-1234-5678" } = values;
  if (name) await user.type(screen.getByLabelText("이름"), name);
  if (birthDate) await user.type(screen.getByLabelText("생년월일"), birthDate);
  if (phone) await user.type(screen.getByLabelText("전화번호"), phone);
  await user.click(screen.getByRole("button", { name: "확인하기" }));
}

describe("SignupFlow — VerifyStep", () => {
  beforeEach(() => {
    mockVerifyRoster.mockReset();
    mockRegister.mockReset();
  });

  it("빈 채로 제출하면 각 필드 검증 메시지가 뜬다", async () => {
    const user = userEvent.setup();
    renderSignupFlow();

    await user.click(screen.getByRole("button", { name: "확인하기" }));

    expect(await screen.findByText("이름을 입력해주세요.")).toBeInTheDocument();
    expect(
      await screen.findByText("생년월일을 YYYY-MM-DD 형식으로 입력해주세요."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("전화번호를 010-0000-0000 형식으로 입력해주세요."),
    ).toBeInTheDocument();
    expect(mockVerifyRoster).not.toHaveBeenCalled();
  });

  it("형식이 틀린 생년월일·전화번호는 각각의 형식 메시지를 보여준다", async () => {
    const user = userEvent.setup();
    renderSignupFlow();

    await fillVerifyStep(user, { name: "김도연", birthDate: "20010314", phone: "01012345678" });

    expect(
      await screen.findByText("생년월일을 YYYY-MM-DD 형식으로 입력해주세요."),
    ).toBeInTheDocument();
    expect(
      await screen.findByText("전화번호를 010-0000-0000 형식으로 입력해주세요."),
    ).toBeInTheDocument();
  });

  it("동명이인(VALIDATION_ERROR)이면 전용 안내 문구를 보여준다", async () => {
    const user = userEvent.setup();
    mockVerifyRoster.mockRejectedValueOnce(
      new ApiError({
        code: "VALIDATION_ERROR",
        message: "명단에 동명이인이 있습니다.",
        status: 400,
      }),
    );
    renderSignupFlow();

    await fillVerifyStep(user);

    expect(
      await screen.findByText(/동명이인 확인이 필요합니다. 임원에게 문의해 주세요\./),
    ).toBeInTheDocument();
  });

  it("동명이인이 아닌 실패는 서버가 준 단일 문구를 그대로 보여준다", async () => {
    const user = userEvent.setup();
    mockVerifyRoster.mockRejectedValueOnce(
      new ApiError({ code: "UNAUTHORIZED", message: "명단과 일치하지 않습니다.", status: 401 }),
    );
    renderSignupFlow();

    await fillVerifyStep(user);

    expect(await screen.findByText(/명단과 일치하지 않습니다\./)).toBeInTheDocument();
  });

  it("확인에 성공하면 RegisterStep으로 전환된다", async () => {
    const user = userEvent.setup();
    mockVerifyRoster.mockResolvedValueOnce({
      registrationToken: "token-123",
      name: "김도연",
      expiresIn: 300,
    });
    renderSignupFlow();

    await fillVerifyStep(user);

    expect(await screen.findByText("김도연님, 확인되었습니다")).toBeInTheDocument();
  });
});

describe("SignupFlow — RegisterStep", () => {
  beforeEach(() => {
    mockVerifyRoster.mockReset();
    mockRegister.mockReset();
  });

  async function goToRegisterStep(user: ReturnType<typeof userEvent.setup>) {
    mockVerifyRoster.mockResolvedValueOnce({
      registrationToken: "token-123",
      name: "김도연",
      expiresIn: 300,
    });
    renderSignupFlow();
    await fillVerifyStep(user);
    await screen.findByText("김도연님, 확인되었습니다");
  }

  it("빈 채로 제출하면 아이디 형식 오류와 비밀번호 확인 메시지가 뜬다", async () => {
    const user = userEvent.setup();
    await goToRegisterStep(user);

    await user.click(screen.getByRole("button", { name: "가입하기" }));

    expect(
      await screen.findByText("아이디는 영문 소문자·숫자 4~20자입니다."),
    ).toBeInTheDocument();
    expect(await screen.findByText("비밀번호는 8자 이상이어야 합니다.")).toBeInTheDocument();
    expect(
      await screen.findByText("비밀번호를 한 번 더 입력해주세요."),
    ).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("비밀번호와 비밀번호 확인이 다르면 passwordConfirm에 불일치 메시지가 붙는다", async () => {
    const user = userEvent.setup();
    await goToRegisterStep(user);

    await user.type(screen.getByLabelText("아이디"), "abcd1234");
    await user.type(screen.getByLabelText("비밀번호"), "verysafepw");
    await user.type(screen.getByLabelText("비밀번호 확인"), "differentpw");
    await user.click(screen.getByRole("button", { name: "가입하기" }));

    expect(await screen.findByText("비밀번호가 일치하지 않습니다.")).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it("UNAUTHORIZED(토큰 만료·재사용)면 세션 만료(시간이 지났습니다) 화면으로 전환된다", async () => {
    const user = userEvent.setup();
    await goToRegisterStep(user);

    mockRegister.mockRejectedValueOnce(
      new ApiError({ code: "UNAUTHORIZED", message: "토큰이 만료되었습니다.", status: 401 }),
    );

    await user.type(screen.getByLabelText("아이디"), "abcd1234");
    await user.type(screen.getByLabelText("비밀번호"), "verysafepw");
    await user.type(screen.getByLabelText("비밀번호 확인"), "verysafepw");
    await user.click(screen.getByRole("button", { name: "가입하기" }));

    expect(await screen.findByText("시간이 지났습니다")).toBeInTheDocument();
  });

  it("loginId 중복 등 필드별 서버 에러는 해당 필드에 붙는다", async () => {
    const user = userEvent.setup();
    await goToRegisterStep(user);

    mockRegister.mockRejectedValueOnce(
      new ApiError({
        code: "DUPLICATE",
        message: "이미 사용 중인 아이디입니다.",
        field: "loginId",
        status: 409,
      }),
    );

    await user.type(screen.getByLabelText("아이디"), "abcd1234");
    await user.type(screen.getByLabelText("비밀번호"), "verysafepw");
    await user.type(screen.getByLabelText("비밀번호 확인"), "verysafepw");
    await user.click(screen.getByRole("button", { name: "가입하기" }));

    const message = await screen.findByText("이미 사용 중인 아이디입니다.");
    expect(message).toBeInTheDocument();
    // 필드별 에러이므로 폼 전체 실패 문구(root)로는 뜨지 않는다
    expect(
      screen.queryByText("가입에 실패했습니다. 잠시 후 다시 시도해주세요."),
    ).not.toBeInTheDocument();
  });
});
