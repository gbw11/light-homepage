import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { LoginForm } from "./LoginForm";
import { ApiError } from "@/lib/api/error";

const mockLogin = vi.fn();
const mockRefetch = vi.fn();
const mockPush = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    api: {
      auth: {
        login: (...args: unknown[]) => mockLogin(...args),
      },
    },
  };
});

vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({ refetch: mockRefetch, user: null, isLoading: false, logout: vi.fn() }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

function renderLoginForm() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <LoginForm />
    </QueryClientProvider>,
  );
}

describe("LoginForm", () => {
  beforeEach(() => {
    mockLogin.mockReset();
    mockRefetch.mockReset();
    mockPush.mockReset();
  });

  it("아이디와 비밀번호를 비운 채 제출하면 각 필드의 검증 메시지가 뜬다", async () => {
    const user = userEvent.setup();
    renderLoginForm();

    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText("아이디를 입력해주세요.")).toBeInTheDocument();
    expect(await screen.findByText("비밀번호를 입력해주세요.")).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("UNAUTHORIZED(401 상당) 에러면 고정된 잠금/실패 문구를 보여준다", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(
      new ApiError({ code: "UNAUTHORIZED", message: "서버가 준 다른 문구", status: 401 }),
    );
    renderLoginForm();

    await user.type(screen.getByLabelText("아이디"), "testuser");
    await user.type(screen.getByLabelText("비밀번호"), "password1");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(
      await screen.findByText("아이디 또는 비밀번호가 올바르지 않습니다."),
    ).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("UNAUTHORIZED가 아닌 ApiError면 그 error.message를 그대로 보여준다", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(
      new ApiError({ code: "VALIDATION_ERROR", message: "요청 형식이 올바르지 않습니다.", status: 400 }),
    );
    renderLoginForm();

    await user.type(screen.getByLabelText("아이디"), "testuser");
    await user.type(screen.getByLabelText("비밀번호"), "password1");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(await screen.findByText("요청 형식이 올바르지 않습니다.")).toBeInTheDocument();
  });

  it("ApiError가 아닌 에러면 일반 실패 문구로 대체한다", async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error("network down"));
    renderLoginForm();

    await user.type(screen.getByLabelText("아이디"), "testuser");
    await user.type(screen.getByLabelText("비밀번호"), "password1");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    expect(
      await screen.findByText("로그인에 실패했습니다. 잠시 후 다시 시도해주세요."),
    ).toBeInTheDocument();
  });

  it("로그인 성공 시 refetch와 /my 이동을 호출한다", async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce({ id: "1", name: "홍길동", role: "MEMBER" });
    renderLoginForm();

    await user.type(screen.getByLabelText("아이디"), "testuser");
    await user.type(screen.getByLabelText("비밀번호"), "password1");
    await user.click(screen.getByRole("button", { name: "로그인" }));

    await waitFor(() => expect(mockRefetch).toHaveBeenCalled());
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/my"));
  });
});
