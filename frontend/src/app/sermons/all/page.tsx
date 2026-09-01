import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { YOUTUBE_CHANNEL_URL } from "@/content/links";
import { SermonArchive } from "./_components/SermonArchive";

export const metadata: Metadata = {
  title: "지난 말씀",
  description: "김해교회 청년교회 LIGHT의 지난 주일 예배 영상입니다.",
};

/**
 * `/sermons/all` — 지난 말씀 전체보기 (PM 요청 2026-09-01).
 *
 * 홈의 "▸ 지난 말씀 전체보기"와 `/sermons`의 같은 링크가 여기로 온다.
 * 한 행에 4개씩, "더 보기"로 이어 붙이고, 끝에서 채널로 보낸다.
 *
 * `/sermons`(라이브 우선)와 나눈 이유는 `SermonArchive` 주석 참고 —
 * 지금 보러 온 사람과 지난 것을 훑는 사람은 필요한 화면이 다르다.
 */
export default function SermonArchivePage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <Link
          href="/sermons"
          className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
        >
          ← 말씀
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">지난 말씀</h1>
        <p className="mt-2 text-[var(--color-gray-400)]">
          주일 예배 영상입니다. 카드를 누르면 YouTube에서 재생됩니다.
        </p>
      </Section>

      <SermonArchive />

      <Section className="pt-10">
        <div className="flex flex-col items-center gap-2">
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
          >
            ▶ 유튜브로 바로가기
          </a>
          <p className="text-center text-sm text-[var(--color-gray-400)]">
            더 지난 영상과 찬양·브이로그는 채널에서 모두 보실 수 있습니다.
          </p>
        </div>
      </Section>
    </main>
  );
}
