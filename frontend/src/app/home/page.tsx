import type { Metadata } from "next";
import { VENUE } from "@/content/location";
import {
  VILLAGE_TIME,
  YOUTH_SERVICE_LINE,
  YOUTH_SERVICE_LINE_PLAIN,
  YOUTH_SERVICE_TIME,
} from "@/content/worship";
import { ViewTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { BulletinLink } from "./_components/BulletinLink";
import { RecentSermon } from "./_components/RecentSermon";
import { WeeklyNotices } from "./_components/WeeklyNotices";
import { LIGHT_WORDMARK } from "@/lib/viewTransition";

export const metadata: Metadata = {
  title: "LIGHT — 김해교회 청년교회",
  description:
    `청년예배 ${YOUTH_SERVICE_LINE_PLAIN}. 하나님 안에 살며, 이웃을 돕는 청년 공동체 LIGHT입니다.`,
};

const ACROSTIC = [
  { letter: "L", rest: "ive" },
  { letter: "I", rest: "n" },
  { letter: "G", rest: "od" },
  { letter: "H", rest: "elp" },
  { letter: "T", rest: "he other" },
];

const CTA_PRIMARY =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95";
const CTA_SECONDARY =
  "inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-white/10 px-6 text-base font-bold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/20";

/**
 * 공개 페이지에 쓸 수 있는 실사진 3장.
 * `public/photos/retreat-2026/`의 47장은 얼굴이 식별되므로 회원 전용이고,
 * 공개 페이지에는 얼굴 비식별(실루엣·뒷모습·군중) 사진 3장만 쓴다.
 * 근거: docs/records/DECISIONS.md "수련회 실사진 공개 페이지 적용 범위", docs/spec/PLAN.md §4.7.
 * 원본이 모두 16:9라서 컨테이너도 16:9로 맞춘다 — 크롭으로 특정 인물이
 * 확대되는 일을 막기 위한 의도적 선택이다.
 */
const GALLERY = [
  {
    src: "/images/worship-wide.webp",
    alt: "불이 켜진 스크린을 향해 두 손을 들고 찬양하는 청년들",
  },
  {
    src: "/images/gathering.webp",
    alt: "드림센터 4층 예배실에 함께 모여 있는 청년교회 공동체",
  },
  {
    src: "/images/worship-hero.webp",
    alt: "어두운 예배 공간에서 손을 들어 찬양하는 청년들의 실루엣",
  },
];

/**
 * WIREFRAME.md §1 — HOME.
 * Hero 원칙: 모바일에서 스크롤 없이 예배 시간 + 장소 + CTA 2개가 모두 보여야 한다.
 */
export default function Home() {
  return (
    <main id="main" tabIndex={-1}>
      {/* Hero */}
      <section className="flex min-h-[calc(100dvh-3.5rem)] items-center bg-[var(--color-navy-900)] text-white">
        <div className="mx-auto grid w-full max-w-[var(--container-max)] gap-8 px-5 py-10 md:grid-cols-2 md:items-center md:px-10">
          <div>
            {/* 첫 화면(`/`)의 워드마크와 같은 이름 — 그쪽 주석 참고 */}
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
            <h1 className="sr-only">LIGHT — 김해교회 청년교회</h1>

            {/*
              주보 로고가 `LIGHT`와 함께 쓰는 성구다. 워드마크(이름 뜻)와 시간
              줄(실용 정보) 사이가 제 자리다 — 이름이 왜 LIGHT인지를 잇는 줄이다.
              어두운 표면이라 `--color-accent-on-dark`를 쓴다 (`--color-yellow`는
              스킴을 따라 뒤집혀 이 표면에서 대비가 깨진다).
            */}
            <p className="mt-5 text-sm text-[var(--color-accent-on-dark)] md:text-base">
              &ldquo;너의 빛으로 세상을 비추라&rdquo; <span className="text-white/60">마태복음 5:16</span>
            </p>

            <p className="mt-4 text-base font-bold text-white/90 md:text-lg">
              {YOUTH_SERVICE_LINE}
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

          {/* Hero 이미지: above the fold(LCP 대상)이므로 즉시 로드.
              Next 16에서 `priority`는 deprecated → loading="eager" + fetchPriority="high"
              (node_modules/next/dist/docs .../components/image.md 참고) */}
          <figure className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-white/5">
            <Image
              src="/images/worship-wide.webp"
              alt="불이 켜진 스크린을 향해 두 손을 들고 찬양하는 청년들"
              fill
              loading="eager"
              fetchPriority="high"
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          </figure>
        </div>
      </section>

      {/* 이번 주 */}
      <Section title="이번 주">
        {/* 공지는 API에서 온다 — `_components/WeeklyNotices.tsx` 주석 참고 */}
        <WeeklyNotices />
        <div className="mt-6 flex gap-4 text-sm font-bold">
          <Link href="/news" className="inline-flex min-h-11 items-center">
            ▸ 공지 전체보기
          </Link>
          {/* 주보는 회원 전용이 됐다 — 로그인한 사람에게만 그린다 (그 조각 주석) */}
          <BulletinLink />
        </div>
      </Section>

      {/* 우리는 */}
      <Section title="우리는">
        <p className="text-xl font-bold leading-relaxed md:text-2xl">
          하나님 안에 살며,
          <br />
          이웃을 돕는 청년 공동체
        </p>

        {/* 기존 4칸 정사각 placeholder → 공개 가능한 사진이 3장뿐이라
            같은 사진을 반복하지 않고 공동체 사진 1장(16:9)으로 대체했다. */}
        <figure className="relative mt-6 aspect-video overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-navy-100)]">
          <Image
            src="/images/gathering.webp"
            alt="드림센터 4층 예배실에 함께 모여 있는 청년교회 공동체"
            fill
            sizes="(min-width: 768px) 720px, 100vw"
            className="object-cover"
          />
        </figure>

        <Link href="/about" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold">
          ▸ 더 알아보기
        </Link>
      </Section>

      {/* 주일에는 이렇게 모입니다 */}
      <Section title="주일에는 이렇게 모입니다">
        <ul className="divide-y divide-[var(--color-navy-100)] rounded-[var(--radius-card)] border border-[var(--color-navy-100)]">
          <li className="p-4">
            {/*
              `YOUTH_GATHERINGS` 배열을 재사용하지 않는다 — 여기는 시각이
              앞에 오고(표는 이름이 앞이다) 장소 칸도 다르다(`1~9마을 +
              새가족마을`). 배열을 억지로 끼우면 데이터가 홈의 편집 문구를
              지배한다. 갈라지면 안 되는 것은 시각이므로 원자만 가져온다.
            */}
            <p className="font-bold">{YOUTH_SERVICE_TIME} · 청년예배</p>
            <p className="text-sm text-[var(--color-gray-400)]">{VENUE}</p>
          </li>
          <li className="p-4">
            <p className="font-bold">{VILLAGE_TIME} · 마을모임 (30분)</p>
            <p className="text-sm text-[var(--color-gray-400)]">
              1~9마을 + 새가족마을
            </p>
          </li>
        </ul>

        <Link href="/worship" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold">
          ▸ 자세히 보기
        </Link>
      </Section>

      {/* 최근 말씀 */}
      <Section title="최근 말씀">
        <RecentSermon />

        {/* 라이브 우선 화면(`/sermons`)이 아니라 아카이브로 보낸다 — 이 링크를
            누르는 사람은 "지난 것"을 찾고 있다 (PM 요청 2026-09-01) */}
        <Link href="/sermons/all" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold">
          ▸ 지난 말씀 전체보기
        </Link>
      </Section>

      {/* 함께한 순간들 */}
      <Section title="함께한 순간들">
        {/* 갤러리 미리보기. 기존 6칸 placeholder → 공개 가능한 3장으로 축소.
            모바일에서도 3열 썸네일 스트립을 유지한다 — 세로로 쌓으면 섹션이
            과도하게 길어지고, 작게 노출되는 편이 초상권 측면에서도 안전하다. */}
        <div className="grid grid-cols-3 gap-3">
          {GALLERY.map((photo) => (
            <figure
              key={photo.src}
              className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-[var(--color-navy-100)]"
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                sizes="33vw"
                className="object-cover"
              />
            </figure>
          ))}
        </div>

        {/*
          사진첩으로 보낸다. 예전에는 사진첩이 회원 전용이라 소식 페이지로
          우회했지만, 공개 열람 전환(PM 결정 2026-08-25)으로 `/photos`가
          누구에게나 열렸다. 위 3장은 공개용 실사진이고, 눌러서 들어가는 앨범
          쪽은 얼굴이 식별되는 사진이 있어 색인은 계속 막혀 있다(robots.ts).
        */}
        <Link href="/photos" className="mt-6 inline-flex min-h-11 items-center text-sm font-bold">
          ▸ 사진첩
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
