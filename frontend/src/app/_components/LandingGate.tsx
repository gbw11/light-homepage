import { ViewTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { LIGHT_WORDMARK } from "@/lib/viewTransition";

const ACROSTIC = [
  { letter: "L", rest: "ive" },
  { letter: "I", rest: "n" },
  { letter: "G", rest: "od" },
  { letter: "H", rest: "elp" },
  { letter: "T", rest: "he other" },
];

/**
 * 첫 화면 `/` — **화면 전체가 하나의 진입 버튼**이다
 * (PM 결정 2026-08-25, 2026-08-21의 "신규/기존 분기 클릭 게이트"를 대체).
 *
 * ## 왜 `<Link>`가 화면을 덮는가
 *
 * "아무 데나 클릭하면 들어간다"를 `<section onClick>`으로 만들면 **마우스에만
 * 동작한다** — 키보드로는 포커스가 갈 곳이 없고, 스크린리더는 이 화면에
 * 눌러야 할 것이 있다는 사실 자체를 읽어주지 못한다. 진짜 링크를 화면 크기로
 * 펼치면 Tab → Enter가 그대로 되고, 가운데 클릭으로 새 탭도 열리며, "메인
 * 화면으로 들어가기"라는 이름이 읽힌다. 겉모습은 같고 동작만 온전해진다.
 *
 * ## 스크롤
 *
 * 높이를 `calc(100dvh - 3.5rem)`(헤더 제외)로 **고정**하고 푸터는
 * `SiteFooter`가 이 경로에서 렌더하지 않는다. 그래서 문서가 뷰포트와 정확히
 * 같아 **스크롤할 것이 없다** — 휠·키보드·터치 어느 쪽으로도 움직이지 않는다.
 * 휠 이벤트를 가로채는 방식이 아니라서 입력 수단마다 동작이 갈리지 않는다.
 *
 * 헤더는 그대로 둔다. 헤더의 [처음이신가요] CTA가 `/welcome`으로 가는 길이고,
 * 그것마저 없애면 처음 온 청년이 길찾기 페이지에 닿을 방법이 사라진다
 * (`PLAN.md §4.2`가 사이트에서 가장 중요하다고 지정한 페이지다).
 *
 * 배경 사진은 순수 장식이라 `alt=""`로 두고, 워드마크는 실제 DOM 텍스트로
 * 남긴다. 스크림(`--color-navy-900` 70%)은 사진 없이 단색이던 때와 명도가
 * 거의 같아 기존 텍스트 대비가 유지된다.
 * 사진 선정 근거: `docs/DECISIONS.md` "수련회 실사진 공개 페이지 적용 범위"(초상권).
 */
export function LandingGate() {
  return (
    <section className="relative h-[calc(100dvh-3.5rem)] overflow-hidden bg-[var(--color-navy-900)] text-center text-white">
      <Image
        src="/images/worship-hero.webp"
        alt=""
        aria-hidden
        fill
        loading="eager"
        fetchPriority="high"
        sizes="100vw"
        className="object-cover"
      />
      <div aria-hidden className="absolute inset-0 bg-[var(--color-navy-900)]/70" />

      <h1 className="sr-only">LIGHT — 김해교회 청년교회</h1>

      <Link
        href="/home"
        aria-label="메인 화면으로 들어가기"
        className="absolute inset-0 flex flex-col items-center justify-center gap-8 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-[var(--color-accent-on-dark)] md:gap-10"
      >
        {/*
          `/home`의 Hero에 있는 같은 워드마크와 **같은 이름**으로 묶는다.
          그러면 `/`에서 `/home`으로 넘어갈 때 브라우저가 두 위치를 잇는
          움직임을 만들어준다 — 가운데에 있던 글자가 Hero의 왼쪽 자리로
          미끄러지듯 옮겨간다. 같은 것을 보고 있다는 신호다.
          이름이 양쪽에서 일치해야만 동작한다 (`LIGHT_WORDMARK`).
        */}
        <ViewTransition name={LIGHT_WORDMARK}>
          <p aria-hidden className="select-none text-lg font-bold leading-tight md:text-2xl">
            {ACROSTIC.map(({ letter, rest }) => (
              <span key={letter} className="block">
                <span className="text-[var(--color-accent-on-dark)]">{letter}</span>
                {rest}
              </span>
            ))}
          </p>
        </ViewTransition>

        {/*
          클릭 대상이라는 걸 알려주는 유일한 단서다. 화면 전체가 버튼인데
          아무 표시도 없으면 사용자는 멈춘 화면으로 읽고 기다린다.
        */}
        <span aria-hidden className="text-sm font-bold text-white/80 md:text-base">
          화면을 눌러 들어가기
        </span>
      </Link>
    </section>
  );
}
