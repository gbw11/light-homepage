"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  /** 같은 줄의 여러 요소를 차례로 띄울 때 — 밀리초 (예: 갤러리 0 · 120 · 240) */
  delay?: number;
  className?: string;
}

/**
 * 스크롤로 화면에 들어올 때 아래에서 떠오르며 나타나는 래퍼 (PM 요청 2026-10-07 —
 * 메인 페이지 스크롤 애니메이션).
 *
 * · **한 번만** 나타난다. 다시 올렸다 내려도 반복하지 않는다 — 읽던 글이 깜빡이면 거슬린다
 * · 내용은 처음부터 HTML에 있다(서버 렌더). 숨기는 것은 CSS뿐이라 검색·스크린리더에는
 *   영향이 없다. 데이터를 새로 불러오는 게 아니다
 * · `prefers-reduced-motion`이면 애니메이션 없이 바로 보인다 (`globals.css` `.reveal`)
 * · JS가 꺼져 있으면 `<noscript>` 스타일로 바로 보인다 (`RevealNoScript`)
 * · `IntersectionObserver`가 없는 환경(구형 브라우저·테스트)에서는 바로 보인다
 *
 * `data-visible`은 React 상태가 아니라 **DOM에 직접** 붙인다. 한 번 켜지면 끝이라
 * 다시 렌더할 이유가 없고, React가 렌더하지 않는 속성이라 덮어쓸 일도 없다.
 */
export function Reveal({ children, delay = 0, className = "" }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const show = () => el.setAttribute("data-visible", "true");
    if (typeof IntersectionObserver === "undefined") {
      show();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          show();
          observer.disconnect();
        }
      },
      // 아래 가장자리에서 조금 올라온 뒤에 띄운다 — 화면 맨 밑에서 이미 끝나 있으면 안 보인다
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const style: CSSProperties | undefined = delay ? { transitionDelay: `${delay}ms` } : undefined;

  return (
    <div ref={ref} className={`reveal ${className}`} style={style}>
      {children}
    </div>
  );
}

/** JS가 꺼진 브라우저에서 `.reveal`이 영영 투명하게 남지 않게 한다. 페이지에 한 번 둔다 */
export function RevealNoScript() {
  return (
    <noscript>
      <style>{".reveal{opacity:1!important;transform:none!important}"}</style>
    </noscript>
  );
}
