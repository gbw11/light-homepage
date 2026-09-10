"use client";

import { ViewTransition } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";
import { LIGHT_WORDMARK } from "@/lib/viewTransition";

const ACROSTIC = [
  { letter: "L", rest: "ive" },
  { letter: "I", rest: "n" },
  { letter: "G", rest: "od" },
  { letter: "H", rest: "elp" },
  { letter: "T", rest: "he other" },
];

/** 한 번의 조작(클릭·휠·Enter) 이후 다음 조작까지 무시하는 시간 — 휠은 한 번
 * 굴릴 때 이벤트가 여러 번 발생해서, 이게 없으면 두 단계를 한 번에 건너뛴다 */
const DEBOUNCE_MS = 500;

/**
 * 첫 화면 `/` — 원래 `/about`에 있던 `LightIntro`(글자가 펼쳐지는 애니메이션)를
 * 여기로 옮기고, 원래 `/`에 있던 전체화면 사진 게이트(`LandingGate`)는
 * `/about`의 정적 히어로로 옮겼다 (PM 요청 2026-09-10).
 *
 * ## 2단계 상호작용
 *
 * 1번째 조작(클릭 · 마우스 휠 · 키보드 Enter/Space) → 큰 "LIGHT" 글자가
 * 사라지고 원래 단어(Live In God Help The other)가 나타난다.
 * 2번째 조작 → `/home`으로 들어간다.
 *
 * 클릭과 휠 둘 다 받는다 — 사용자가 편한 쪽으로 조작하면 된다. 실제 스크롤이
 * 있는 화면이 아니라서(`LightIntro`처럼 스크롤 위치를 읽지 않는다) 휠 이벤트
 * 자체를 조작 신호로만 쓴다.
 *
 * 펼쳐진 뒤의 글자는 `/home` Hero의 워드마크와 **완전히 같은 마크업 +
 * ViewTransition 이름**을 쓴다 — 그래야 `/home`으로 넘어갈 때 브라우저가
 * 둘을 같은 것으로 보고 자연스러운 움직임을 만든다 (`lib/viewTransition.ts`,
 * 원래 `LandingGate`가 하던 것과 같은 방식).
 */
export function IntroGate() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const lastActionAt = useRef(0);

  const advance = useCallback(() => {
    const now = Date.now();
    if (now - lastActionAt.current < DEBOUNCE_MS) return;
    lastActionAt.current = now;

    if (!expanded) {
      setExpanded(true);
      return;
    }
    router.push("/home");
  }, [expanded, router]);

  return (
    <section
      role="button"
      tabIndex={0}
      aria-label={expanded ? "메인 화면으로 들어가기" : "눌러서 LIGHT의 뜻 보기"}
      onClick={advance}
      onWheel={(e) => {
        if (Math.abs(e.deltaY) > 4) advance();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          advance();
        }
      }}
      className="relative flex h-[calc(100dvh-3.5rem)] cursor-pointer select-none flex-col items-center justify-center overflow-hidden bg-[var(--color-navy-900)] text-center text-white focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--color-accent-on-dark)]"
    >
      <h1 className="sr-only">LIGHT — 김해교회 청년교회</h1>

      {/* 접힌 상태 — 큰 "LIGHT" 다섯 글자, 펼치면 사라진다 */}
      <div
        aria-hidden={expanded}
        className={`absolute inset-0 flex items-center justify-center gap-2 text-6xl font-bold text-[var(--color-accent-on-dark)] transition-opacity duration-500 md:text-7xl ${
          expanded ? "opacity-0" : "opacity-100"
        }`}
      >
        {ACROSTIC.map(({ letter }) => (
          <span key={letter}>{letter}</span>
        ))}
      </div>

      {/*
        펼친 상태 — `/home` Hero와 완전히 같은 마크업(§`home/page.tsx`).
        같은 ViewTransition 이름을 써야 두 화면이 이어져 보인다.

        `absolute inset-0 flex`로 직접 중앙 정렬한다 — `ViewTransition`으로
        감싼 자식은 부모 flex의 `items-center`/`justify-center`에 기대면
        엉뚱한 위치(우측 하단)에 붙는 현상이 있어(2026-09-10 실측), 위치를
        스스로 책임지게 했다.
      */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-8">
        <ViewTransition name={LIGHT_WORDMARK}>
          <p
            aria-hidden={!expanded}
            className={`select-none text-lg font-bold leading-tight transition-opacity delay-200 duration-500 md:text-2xl ${
              expanded ? "opacity-100" : "opacity-0"
            }`}
          >
            {ACROSTIC.map(({ letter, rest }) => (
              <span key={letter} className="block">
                <span className="text-[var(--color-accent-on-dark)]">{letter}</span>
                {rest}
              </span>
            ))}
          </p>
        </ViewTransition>

        <span
          aria-hidden
          className={`text-sm font-bold text-white transition-opacity delay-200 duration-500 md:text-base ${
            expanded ? "opacity-100" : "opacity-0"
          }`}
        >
          한 번 더 누르면 들어갑니다
        </span>
      </div>
    </section>
  );
}
