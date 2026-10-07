import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Reveal } from "./Reveal";

type Callback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

/** 화면 진입을 테스트가 직접 일으킬 수 있는 가짜 IntersectionObserver */
function installObserver() {
  const observers: { callback: Callback; disconnect: ReturnType<typeof vi.fn> }[] = [];
  class FakeObserver {
    disconnect = vi.fn();
    constructor(callback: Callback) {
      observers.push({ callback, disconnect: this.disconnect });
    }
    observe() {}
  }
  vi.stubGlobal("IntersectionObserver", FakeObserver);
  return observers;
}

function wrapper() {
  return screen.getByText("내용").parentElement as HTMLElement;
}

describe("Reveal — 스크롤 등장", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("내용은 처음부터 DOM에 있고, 화면에 들어오기 전에는 숨김 상태다", () => {
    installObserver();
    render(
      <Reveal>
        <p>내용</p>
      </Reveal>,
    );
    expect(screen.getByText("내용")).toBeInTheDocument();
    expect(wrapper()).not.toHaveAttribute("data-visible");
  });

  it("화면에 들어오면 나타나고, 관찰을 끝낸다(한 번만)", () => {
    const observers = installObserver();
    render(
      <Reveal>
        <p>내용</p>
      </Reveal>,
    );

    act(() => observers[0].callback([{ isIntersecting: true }]));

    expect(wrapper()).toHaveAttribute("data-visible", "true");
    expect(observers[0].disconnect).toHaveBeenCalled();
  });

  it("화면 밖 알림에는 반응하지 않는다", () => {
    const observers = installObserver();
    render(
      <Reveal>
        <p>내용</p>
      </Reveal>,
    );

    act(() => observers[0].callback([{ isIntersecting: false }]));

    expect(wrapper()).not.toHaveAttribute("data-visible");
  });

  it("IntersectionObserver가 없으면 바로 보인다", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(
      <Reveal>
        <p>내용</p>
      </Reveal>,
    );
    expect(wrapper()).toHaveAttribute("data-visible", "true");
  });

  it("delay를 transition-delay로 건다", () => {
    installObserver();
    render(
      <Reveal delay={240}>
        <p>내용</p>
      </Reveal>,
    );
    expect(wrapper().style.transitionDelay).toBe("240ms");
  });
});
