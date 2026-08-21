import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "LIGHT — 김해교회 청년교회",
  description:
    "청년예배 주일 14:00 드림센터 4층. 하나님 안에 살며, 이웃을 돕는 청년 공동체 LIGHT입니다.",
};

const NOTICES = [
  { date: "8/24", title: "수련회 신청 안내" },
  { date: "8/22", title: "마을모임 장소 변경" },
  { date: "8/18", title: "여름 특별 새벽예배 안내" },
];

const RECENT_SERMON = {
  title: "흔들리지 않는 믿음",
  date: "2026.08.16",
};

const ACROSTIC = [
  { letter: "L", rest: "ive" },
  { letter: "I", rest: "n" },
  { letter: "G", rest: "od" },
  { letter: "H", rest: "elp" },
  { letter: "T", rest: "he other" },
];

const CTA_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-navy-900)] transition hover:brightness-95";
const CTA_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-white/10 px-6 text-base font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20";

/**
 * WIREFRAME.md §1 — HOME.
 * 실사진 확보 전까지 Hero는 딥네이비 단색 + 워드마크로 대체 (기획 문서 명시).
 * Hero 원칙: 모바일에서 스크롤 없이 예배 시간 + 장소 + CTA 2개가 모두 보여야 한다.
 */
export default function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="flex min-h-[calc(100dvh-3.5rem)] items-center bg-[var(--color-navy-900)] text-white">
        <div className="mx-auto grid w-full max-w-[var(--container-max)] gap-8 px-5 py-10 md:grid-cols-2 md:items-center md:px-10">
          <div>
            <p aria-hidden className="select-none text-lg font-bold leading-tight md:text-2xl">
              {ACROSTIC.map(({ letter, rest }) => (
                <span key={letter} className="block">
                  <span className="text-[var(--color-yellow)]">{letter}</span>
                  {rest}
                </span>
              ))}
            </p>
            <h1 className="sr-only">LIGHT — 김해교회 청년교회</h1>

            <p className="mt-6 text-base font-bold text-white/90 md:text-lg">
              주일 14:00 · 드림센터 4층
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/welcome" className={CTA_PRIMARY}>
                처음 오시는 분
              </Link>
              <Link href="/location" className={CTA_SECONDARY}>
                오시는 길
              </Link>
            </div>
          </div>

          <figure
            aria-hidden
            className="flex aspect-[4/3] items-center justify-center rounded-[var(--radius-card)] bg-white/5 text-sm text-white/40 md:aspect-auto md:h-full"
          >
            청년부 사진 (준비 중)
          </figure>
        </div>
      </section>

      {/* 이번 주 */}
      <Section title="이번 주">
        <ul className="divide-y divide-[var(--color-navy-100)]">
          {NOTICES.map((notice) => (
            <li key={notice.title} className="flex gap-4 py-3">
              <span className="w-12 shrink-0 text-sm text-[var(--color-gray-400)]">
                {notice.date}
              </span>
              <span className="font-bold">{notice.title}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-4 text-sm font-bold">
          <Link href="/news">▸ 공지 전체보기</Link>
          {/* 주보 보기: /bulletin 라우트 미구현 (M3 예정). 링크 없이 텍스트만 노출 */}
          <span className="text-[var(--color-gray-400)]">▸ 주보 보기</span>
        </div>
      </Section>

      {/* 우리는 */}
      <Section title="우리는">
        <p className="text-xl font-bold leading-relaxed md:text-2xl">
          하나님 안에 살며,
          <br />
          이웃을 돕는 청년 공동체
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <figure
              key={index}
              aria-hidden
              className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-gray-400)]"
            >
              사진
            </figure>
          ))}
        </div>

        <Link href="/about" className="mt-6 inline-block text-sm font-bold">
          ▸ 더 알아보기
        </Link>
      </Section>

      {/* 주일에는 이렇게 모입니다 */}
      <Section title="주일에는 이렇게 모입니다">
        <ul className="divide-y divide-[var(--color-navy-100)] rounded-[var(--radius-card)] border border-[var(--color-navy-100)]">
          <li className="p-4">
            <p className="font-bold">14:00 · 청년예배</p>
            <p className="text-sm text-[var(--color-gray-400)]">드림센터 4층</p>
          </li>
          <li className="p-4">
            <p className="font-bold">15:30 · 마을모임 (30분)</p>
            <p className="text-sm text-[var(--color-gray-400)]">
              1~9마을 + 새가족마을
            </p>
          </li>
        </ul>

        <Link href="/worship" className="mt-6 inline-block text-sm font-bold">
          ▸ 자세히 보기
        </Link>
      </Section>

      {/* 최근 말씀 */}
      <Section title="최근 말씀">
        <div className="max-w-sm rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 md:max-w-none">
          <figure
            aria-hidden
            className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-gray-400)]"
          >
            썸네일 (16:9)
          </figure>
          <p className="mt-4 font-bold">{RECENT_SERMON.title}</p>
          <p className="text-sm text-[var(--color-gray-400)]">{RECENT_SERMON.date}</p>
        </div>

        <Link href="/sermons" className="mt-6 inline-block text-sm font-bold">
          ▸ 지난 말씀 전체보기
        </Link>
      </Section>

      {/* 함께한 순간들 */}
      <Section title="함께한 순간들">
        <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <figure
              key={index}
              aria-hidden
              className="flex aspect-square items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-xs text-[var(--color-gray-400)]"
            >
              사진
            </figure>
          ))}
        </div>

        {/* 갤러리 탭 미구현 — 소식 페이지로 연결 */}
        <Link href="/news" className="mt-6 inline-block text-sm font-bold">
          ▸ 갤러리
        </Link>
      </Section>

      {/* 처음 오시나요 (강조 블록) */}
      <Section>
        <div className="rounded-[var(--radius-card)] bg-[var(--color-navy-900)] p-6 text-white md:p-10">
          <h2 className="text-xl font-bold md:text-2xl">처음 오시나요?</h2>
          <p className="mt-4 leading-relaxed text-white/80">
            드림센터가 본당과 다른 건물이라 헷갈리기 쉬워요. 길 안내부터 예배
            흐름까지 정리해뒀습니다.
          </p>
          <Link href="/welcome" className={`${CTA_PRIMARY} mt-6`}>
            처음 오시는 분 안내
          </Link>
        </div>
      </Section>
    </main>
  );
}
