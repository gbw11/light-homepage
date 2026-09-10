"use client";

import { useEffect, useRef, useState } from "react";

const ITEMS = [
  { letter: "L", word: "Live" },
  { letter: "I", word: "In" },
  { letter: "G", word: "God" },
  { letter: "H", word: "Help" },
  { letter: "T", word: "The other" },
] as const;

/** 바깥 래퍼 높이 (뷰포트 비율) — 이 구간만큼 안쪽 콘텐츠가 화면에 고정된다 */
const PIN_VH = 220;
/** 이 비율만큼 스크롤하면(휠 한 번 정도) 세로 배치로 전환한다 */
const TRIGGER_RATIO = 0.06;

/**
 * `/about` 첫 화면 — 처음엔 "LIGHT"만 가로로 보이다가, 스크롤을 한 번 내리면
 * 각 글자가 세로로 재배치되며 원래 단어(Live In God Help The other)로
 * 펼쳐진다. WIREFRAME.md에는 아직 없음 — PM 요청 2026-09-10.
 *
 * 스크롤 위치를 직접 계산해 전환한다(래퍼 높이 `PIN_VH`만큼 스크롤 가능한
 * 여유를 두고, `sticky`로 그동안 화면에 고정) — 별도 애니메이션 라이브러리
 * 없이 CSS transition만으로 처리한다 (`CONVENTIONS.md` §1, 새 의존성 금지).
 */
export function LightIntro() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    function onScroll() {
      const el = wrapperRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(Math.max(-rect.top / scrollable, 0), 1);
      setExpanded(progress > TRIGGER_RATIO);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div ref={wrapperRef} style={{ height: `${PIN_VH}vh` }} className="relative">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <div className="relative h-20 w-full max-w-md md:h-24">
          {ITEMS.map((item, i) => {
            const collapsedX = (i - 2) * 64;
            const expandedY = (i - 2) * 76;
            const transform = expanded
              ? `translate(-50%, calc(-50% + ${expandedY}px))`
              : `translate(calc(-50% + ${collapsedX}px), -50%)`;

            return (
              <div
                key={item.letter}
                className="absolute left-1/2 top-1/2 h-16 w-40 transition-transform duration-700 ease-in-out md:h-20"
                style={{ transform }}
              >
                <span
                  aria-hidden={expanded}
                  className={`absolute inset-0 flex items-center justify-center text-6xl font-bold text-[var(--color-yellow)] transition-opacity duration-500 md:text-7xl ${
                    expanded ? "opacity-0" : "opacity-100"
                  }`}
                >
                  {item.letter}
                </span>
                <span
                  aria-hidden={!expanded}
                  className={`absolute inset-0 flex items-center justify-center whitespace-nowrap text-3xl font-bold text-[var(--color-yellow)] transition-opacity delay-200 duration-500 md:text-4xl ${
                    expanded ? "opacity-100" : "opacity-0"
                  }`}
                >
                  {item.word}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
