import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoadMoreButton } from "./LoadMoreButton";

describe("LoadMoreButton", () => {
  it("다음 페이지가 없으면 그리지 않는다", () => {
    const { container } = render(
      <LoadMoreButton hasNextPage={false} isFetching={false} onClick={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("누르면 onClick", async () => {
    const onClick = vi.fn();
    render(<LoadMoreButton hasNextPage isFetching={false} onClick={onClick} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "더 보기" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("불러오는 동안은 비활성", () => {
    render(<LoadMoreButton hasNextPage isFetching onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "불러오는 중..." })).toBeDisabled();
  });
});
