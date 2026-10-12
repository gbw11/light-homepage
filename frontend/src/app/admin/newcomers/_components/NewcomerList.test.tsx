import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NewcomerRecord, Page } from "@/types/api";
import { api } from "@/lib/api";
import { NewcomerList } from "./NewcomerList";

vi.mock("@/lib/api", () => ({
  api: { admin: { newcomers: vi.fn() } },
  isApiError: () => false,
}));

const mockNewcomers = vi.mocked(api.admin.newcomers);

function record(id: string, name: string): NewcomerRecord {
  return {
    id,
    name,
    phone: "010-0000-0000",
    gender: null,
    ageGroup: null,
    referrer: null,
    message: null,
    createdAt: "2026-08-19T10:22:00Z",
  };
}

const PAGES: Page<NewcomerRecord>[] = [
  { items: [record("14", "김OO")], page: 0, size: 1, hasNext: true },
  { items: [record("13", "박OO")], page: 1, size: 1, hasNext: false },
];

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NewcomerList />
    </QueryClientProvider>,
  );
}

describe("NewcomerList — 페이지 넘김 (점검 🟠-5)", () => {
  beforeEach(() => {
    mockNewcomers.mockReset();
    mockNewcomers.mockImplementation(async (params) => PAGES[params?.page ?? 0]);
    Element.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    window.location.hash = "";
  });

  it("더 보기로 다음 신청을 이어 붙인다", async () => {
    renderList();
    expect(await screen.findByText("김OO")).toBeInTheDocument();
    expect(screen.queryByText("박OO")).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "더 보기" }));

    expect(await screen.findByText("박OO")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "더 보기" })).not.toBeInTheDocument();
  });

  it("알림이 가리키는 신청이 다음 페이지에 있으면 거기까지 불러온다", async () => {
    window.location.hash = "#newcomer-13";
    renderList();

    expect(await screen.findByText("박OO")).toBeInTheDocument();
    expect(mockNewcomers).toHaveBeenCalledWith({ page: 1 });
  });
});
