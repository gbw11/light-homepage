import Image from "next/image";

const ACROSTIC = [
  { letter: "L", rest: "ive" },
  { letter: "I", rest: "n" },
  { letter: "G", rest: "od" },
  { letter: "H", rest: "elp" },
  { letter: "T", rest: "he other" },
];

/**
 * `/about` 첫 화면 — 원래 `/`에 있던 전체화면 사진 게이트(`LandingGate`)를
 * 여기로 옮긴 정적 버전이다 (PM 요청 2026-09-10). `/`은 이제 `IntroGate`(글자가
 * 펼쳐지는 애니메이션)가 그 자리를 대신하고, 여기는 **클릭해도 이동하지
 * 않는** 순수 장식 히어로다 — 소개 페이지는 콘텐츠 페이지이지 진입 게이트가
 * 아니다.
 *
 * 그래서 `LandingGate`와 달리:
 * - `<Link>`로 화면을 덮지 않는다 (이동할 곳이 없다)
 * - `/home` Hero와 이어지는 `ViewTransition`을 쓰지 않는다 (그 이름은 `/`↔`/home`
 *   전용이다 — 여기서 같이 쓰면 셋을 잇는 의도치 않은 전환이 생길 수 있다)
 * - 화면 전체 높이(`100dvh`)로 고정하지 않는다 — 아래에 실제 소개 콘텐츠가
 *   이어지는 스크롤 페이지의 맨 위 섹션일 뿐이다
 */
export function AboutHero() {
  return (
    <section className="relative flex h-[70vh] min-h-[420px] items-center justify-center overflow-hidden bg-[var(--color-navy-900)] text-center text-white">
      <Image
        src="/images/worship-hero.webp"
        alt=""
        aria-hidden
        fill
        sizes="100vw"
        className="object-cover"
      />
      <p
        aria-hidden
        className="relative select-none text-lg font-bold leading-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.95),0_0_10px_rgba(0,0,0,0.9),0_0_28px_rgba(0,0,0,0.75)] md:text-2xl"
      >
        {ACROSTIC.map(({ letter, rest }) => (
          <span key={letter} className="block">
            <span className="text-[var(--color-accent-on-dark)]">{letter}</span>
            {rest}
          </span>
        ))}
      </p>
    </section>
  );
}
