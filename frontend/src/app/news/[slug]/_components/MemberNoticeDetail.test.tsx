import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { api, ServerUnavailableError } from "@/lib/api";
import { MemberNoticeDetail } from "./MemberNoticeDetail";

vi.mock("@/components/auth/MemberGate", () => ({
  MemberGate: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./NoticeDetailView", () => ({
  NoticeDetailView: ({ notice }: { notice: { title: string } }) => <h1>{notice.title}</h1>,
}));
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return { ...actual, api: { posts: { get: vi.fn() } } };
});

const mockGet = vi.mocked(api.posts.get);

function renderDetail() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemberNoticeDetail slug="retreat" />
    </QueryClientProvider>,
  );
}

describe("MemberNoticeDetail — 서버가 꺼졌을 때 (점검 🟠-15)", () => {
  it("'찾을 수 없는 글'이 아니라 '잠시 후 다시'를 안내하고, 다시 시도로 회복한다", async () => {
    mockGet.mockRejectedValueOnce(new ServerUnavailableError(502));
    mockGet.mockResolvedValueOnce({ title: "수련회 안내" } as Awaited<ReturnType<typeof api.posts.get>>);

    renderDetail();

    expect(await screen.findByRole("alert")).toHaveTextContent("잠시 후 다시 시도해 주세요");
    expect(screen.queryByText("찾을 수 없는 글입니다.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "수련회 안내" })).toBeInTheDocument());
  });
});
