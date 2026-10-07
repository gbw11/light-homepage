import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BulletinViewer } from "./BulletinViewer";
import type { Bulletin, BulletinPage } from "@/types/api";

vi.mock("@/lib/api", () => ({
  api: {
    bulletins: {
      downloadUrl: (id: string, pageNo: number) => `/mock-download/${id}/${pageNo}`,
    },
  },
}));

function page(pageNo: number): BulletinPage {
  return { pageNo, url: `https://example.com/page-${pageNo}.jpg`, width: 1448, height: 2048 };
}

function bulletin(pageCount: number): Bulletin {
  return {
    id: "bulletin-1",
    serviceDate: "2026-08-24",
    pages: Array.from({ length: pageCount }, (_, i) => page(i + 1)),
  };
}

/**
 * jsdom에는 `TouchEvent`/`Touch` 생성자가 없다. `fireEvent.touchStart` 등은
 * 컴포넌트가 실제로 읽는 속성(`e.touches`, `e.changedTouches`)만 이벤트 객체에
 * 얹어주면 되므로, 실제 `Touch` 인스턴스 없이 일반 객체 배열로 충분하다.
 */
function touch(clientX: number, clientY: number) {
  return { clientX, clientY };
}

function swipe(el: Element, start: [number, number], end: [number, number]) {
  fireEvent.touchStart(el, { touches: [touch(...start)] });
  fireEvent.touchEnd(el, { touches: [], changedTouches: [touch(...end)] });
}

describe("BulletinViewer", () => {
  // usePinchZoom의 더블탭 판정(300ms)이 Date.now()를 쓴다. 연속 스와이프를
  // 테스트할 때 실제 시계로는 두 터치가 300ms 안에 몰려 더블탭으로 오판된다
  // (실기기라면 손가락을 떼고 다시 짚는 사이 자연히 300ms가 지난다).
  // 가짜 타이머로 그 간격만큼 시간을 흘려보낸다.
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("장이 1개면 페이저(‹ N / M ›)를 렌더하지 않는다", () => {
    render(<BulletinViewer bulletin={bulletin(1)} />);

    expect(screen.queryByLabelText("이전 장")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("다음 장")).not.toBeInTheDocument();
    expect(screen.queryByText("1 / 1")).not.toBeInTheDocument();
  });

  it("장이 여러 개면 페이저가 렌더되고 초기 위치는 1장이다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByLabelText("이전 장")).toBeDisabled();
    expect(screen.getByLabelText("다음 장")).not.toBeDisabled();
  });

  it("→ 키로 다음 장, ← 키로 이전 장으로 이동한다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByLabelText("다음 장")).toBeDisabled();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("입력 요소에 포커스가 있으면 ←/→ 를 가로채지 않는다", () => {
    render(
      <div>
        <input aria-label="검색" />
        <BulletinViewer bulletin={bulletin(3)} />
      </div>,
    );

    const input = screen.getByLabelText("검색");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowRight" });

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("왼쪽으로 크게 스와이프하면 다음 장으로 넘어간다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);
    const img = screen.getByAltText("2026-08-24 주보 1장");
    const box = img.parentElement as HTMLElement;

    swipe(box, [200, 100], [100, 100]); // dx = -100 (임계값 50 초과)

    expect(screen.getByText("2 / 3")).toBeInTheDocument();
  });

  it("오른쪽으로 크게 스와이프하면 이전 장으로 넘어간다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);
    const img = screen.getByAltText("2026-08-24 주보 1장");
    const box = img.parentElement as HTMLElement;

    // 먼저 2장으로 이동
    swipe(box, [200, 100], [100, 100]);
    expect(screen.getByText("2 / 3")).toBeInTheDocument();

    // 더블탭 판정 창(300ms)을 벗어나게 시간을 흘려보낸다
    vi.advanceTimersByTime(400);

    swipe(box, [100, 100], [200, 100]); // dx = +100

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("임계값(50px) 미만 이동은 장을 넘기지 않는다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);
    const img = screen.getByAltText("2026-08-24 주보 1장");
    const box = img.parentElement as HTMLElement;

    swipe(box, [200, 100], [170, 100]); // dx = -30

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("세로 이동이 더 크면 스와이프로 인정하지 않는다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);
    const img = screen.getByAltText("2026-08-24 주보 1장");
    const box = img.parentElement as HTMLElement;

    swipe(box, [200, 100], [100, 260]); // dx = -100, dy = 160

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("두 손가락(핀치)로 시작하면 스와이프 판정을 포기한다", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);
    const img = screen.getByAltText("2026-08-24 주보 1장");
    const box = img.parentElement as HTMLElement;

    fireEvent.touchStart(box, { touches: [touch(200, 100), touch(210, 100)] });
    fireEvent.touchEnd(box, { touches: [], changedTouches: [touch(100, 100)] });

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });

  it("확대된 상태에서 가로로 드래그해도 장을 넘기지 않는다 (이미지 팬으로 처리됨)", () => {
    render(<BulletinViewer bulletin={bulletin(3)} />);
    const img = screen.getByAltText("2026-08-24 주보 1장");
    const box = img.parentElement as HTMLElement;

    // 더블탭으로 확대(usePinchZoom의 onDoubleClick과 동일한 경로)
    fireEvent.doubleClick(box);

    // 확대 중 가로 스와이프 — 장 넘김이 아니라 팬이어야 한다
    swipe(box, [200, 100], [100, 100]);

    expect(screen.getByText("1 / 3")).toBeInTheDocument();
  });
});
