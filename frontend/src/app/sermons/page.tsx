import type { Metadata } from "next";
import { toKoreanTime, YOUTH_SERVICE_LINE_PLAIN, YOUTH_SERVICE_TIME } from "@/content/worship";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { YOUTUBE_CHANNEL_URL } from "@/content/links";
import { LiveSection } from "./_components/LiveSection";

export const metadata: Metadata = {
  title: "말씀",
  description:
    `김해교회 청년교회 LIGHT 주일 예배 라이브와 최근 예배 영상입니다. ${YOUTH_SERVICE_LINE_PLAIN}.`,
};

/**
 * WIREFRAME.md §5 `/sermons` — FR-PUB-09 (구성 변경 2026-09-01, PM 결정).
 *
 * ## 구성
 *
 * 1. **라이브 중이면** 재생 화면 + "라이브로 바로 가기"
 * 2. **아니면** 최근 예배 영상 4편을 한 줄로
 * 3. 맨 아래 **유튜브로 바로가기** — 채널 메인
 *
 * ## 왜 전체 목록(무한 스크롤)을 걷어냈나
 *
 * 예전에는 12편씩 "더 보기"로 계속 불러왔다. 그런데 이 화면이 하는 일은
 * **지금 예배를 보러 온 사람을 3초 안에 재생으로 보내는 것**이고, 지난 영상
 * 210편의 아카이브는 YouTube가 우리보다 잘한다(검색·재생목록·자막).
 * 목록을 그대로 두면 화면의 목적이 둘로 갈리고, CLS가 가장 심했던 자리도
 * 그 목록이었다 (CLS 0.537 — 걷어내면서 함께 사라졌다).
 *
 * → **최근 4편 + 채널 링크**로 좁혔다. 전체 아카이브는 채널이 담당한다.
 *
 * ⚠️ 라이브 판정은 **백엔드가 YouTube Data API를 프록시**해서 준다 — API 키를
 * 클라이언트에 실을 수 없다 (`types/api.ts`의 `LiveStream` 주석).
 * 아직 백엔드 계약이 확정되지 않았다 (`BACKEND_HANDOFF.md` 2026-09-01 항목).
 */
export default function SermonsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">말씀</h1>
        <p className="mt-2 text-[var(--color-gray-400)]">
          주일 청년예배는 {toKoreanTime(YOUTH_SERVICE_TIME)}에 라이브로 올라옵니다.
        </p>
      </Section>

      <LiveSection />

      <Section className="pt-10">
        <div className="flex flex-col items-center gap-4">
          <Link
            href="/sermons/all"
            className="inline-flex min-h-11 items-center text-sm font-bold"
          >
            ▸ 지난 말씀 전체보기
          </Link>

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
              찬양·브이로그를 포함한 모든 영상은 채널에서 보실 수 있습니다.
            </p>
          </div>
        </div>
      </Section>
    </main>
  );
}
