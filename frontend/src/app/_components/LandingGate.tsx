"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

const ACROSTIC = [
  { letter: "L", rest: "ive" },
  { letter: "I", rest: "n" },
  { letter: "G", rest: "od" },
  { letter: "H", rest: "elp" },
  { letter: "T", rest: "he other" },
];

const CTA_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95 md:min-h-12 md:px-8 md:text-lg";

/**
 * 첫 화면 클릭 게이트 (PM 결정: docs/DECISIONS.md "첫 화면 클릭 게이트: 신규/기존 방문자 분기").
 * - 전체 영역 클릭 → /login (기존 방문자로 가정, 보너스 동작)
 * - "처음 오시는 분이신가요?" 버튼 → /welcome (주 진입점, 접근성 보장을 위해 실제 button)
 */
export function LandingGate() {
  const router = useRouter();

  const handleAreaClick = () => {
    router.push("/login");
  };

  const handleWelcomeClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    router.push("/welcome");
  };

  return (
    <section
      onClick={handleAreaClick}
      className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center bg-[var(--color-navy-900)] px-5 text-center text-white"
    >
      <div className="flex flex-col items-center gap-8 md:gap-10">
        <p aria-hidden className="select-none text-lg font-bold leading-tight md:text-2xl">
          {ACROSTIC.map(({ letter, rest }) => (
            <span key={letter} className="block">
              <span className="text-[var(--color-yellow)]">{letter}</span>
              {rest}
            </span>
          ))}
        </p>
        <h1 className="sr-only">LIGHT — 김해교회 청년교회</h1>

        <button type="button" onClick={handleWelcomeClick} className={CTA_PRIMARY}>
          처음 오시는 분이신가요?
        </button>
      </div>
    </section>
  );
}
