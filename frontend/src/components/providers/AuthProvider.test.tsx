import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/types/api";
import { AuthProvider, useAuth } from "./AuthProvider";

/**
 * USERFLOW_AUDIT 2026-10-07 🟠-4 — 로그아웃·탈퇴 뒤에 회원 데이터(회원 공지
 * 제목 등)가 react-query 캐시에 남아 같은 탭에서 보이면 안 된다.
 */

const user: AuthUser = { id: "1", name: "홍길동", loginId: "hong", phone: "010-0000-0000", role: "MEMBER" };

vi.mock("@/lib/api", () => ({
  api: { auth: { me: vi.fn(async () => user), logout: vi.fn(async () => {}) } },
  isApiError: () => false,
  onSessionExpired: () => () => {},
}));

function Probe() {
  const { user: current, logout, clearSession } = useAuth();
  return (
    <>
      <p>{current ? `로그인:${current.name}` : "비로그인"}</p>
      <button onClick={() => void logout()}>로그아웃</button>
      <button onClick={clearSession}>세션비우기</button>
    </>
  );
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // 회원 공지 목록이 캐시에 남아 있는 상태
  client.setQueryData(["posts", "MEMBER_NOTICE"], [{ id: "p1", title: "회원 공지" }]);
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return client;
}

describe("AuthProvider 세션 종료 시 캐시 비우기", () => {
  it("logout은 회원 데이터 캐시를 지우고 비로그인 상태로 바꾼다", async () => {
    const client = setup();
    await screen.findByText("로그인:홍길동");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "로그아웃" }));
    });

    expect(client.getQueryData(["posts", "MEMBER_NOTICE"])).toBeUndefined();
    await waitFor(() => expect(screen.getByText("비로그인")).toBeInTheDocument());
  });

  it("clearSession(탈퇴 후)도 같은 일을 한다", async () => {
    const client = setup();
    await screen.findByText("로그인:홍길동");

    fireEvent.click(screen.getByRole("button", { name: "세션비우기" }));

    expect(client.getQueryData(["posts", "MEMBER_NOTICE"])).toBeUndefined();
    await waitFor(() => expect(screen.getByText("비로그인")).toBeInTheDocument());
  });
});
