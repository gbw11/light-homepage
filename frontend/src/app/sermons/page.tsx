import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "말씀 | LIGHT",
  description: "LIGHT 청년교회 YouTube 채널의 설교 영상 목록입니다.",
};

const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@light4402";

interface Sermon {
  id: string;
  title: string;
  date: string;
  youtubeUrl: string;
}

/**
 * WIREFRAME.md §5 — 더미 데이터. 실제 영상 목록은 YouTube API 연동 후
 * `@/lib/api`를 통해 대체한다 (이번 단위는 정적 구조 + 더미 데이터까지).
 */
const SERMONS: Sermon[] = [
  {
    id: "1",
    title: "오늘, 다시 시작하는 믿음",
    date: "2026. 8. 17.",
    youtubeUrl: YOUTUBE_CHANNEL_URL,
  },
  {
    id: "2",
    title: "은혜 위에 서다",
    date: "2026. 8. 10.",
    youtubeUrl: YOUTUBE_CHANNEL_URL,
  },
  {
    id: "3",
    title: "함께 걷는 믿음의 길",
    date: "2026. 8. 3.",
    youtubeUrl: YOUTUBE_CHANNEL_URL,
  },
  {
    id: "4",
    title: "소망을 심는 사람",
    date: "2026. 7. 27.",
    youtubeUrl: YOUTUBE_CHANNEL_URL,
  },
  {
    id: "5",
    title: "작은 자를 세우시는 하나님",
    date: "2026. 7. 20.",
    youtubeUrl: YOUTUBE_CHANNEL_URL,
  },
  {
    id: "6",
    title: "다시 사랑으로",
    date: "2026. 7. 13.",
    youtubeUrl: YOUTUBE_CHANNEL_URL,
  },
];

/**
 * WIREFRAME.md §5 `/sermons` — FR-PUB-09.
 * 카드 탭 → YouTube로 새 탭 이동 (자체 플레이어 없음).
 * 설교자·본문 정보는 표시하지 않음 (SPEC_FUNCTIONAL.md FR-PUB-09: 정보 없음).
 */
export default function SermonsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">말씀</h1>
      </Section>

      <Section className="pt-0">
        <ul className="grid gap-6 md:grid-cols-3">
          {SERMONS.map((sermon) => (
            <li key={sermon.id}>
              <a
                href={sermon.youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-[var(--radius-card)] transition hover:opacity-90"
              >
                <div className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-gray-400)]">
                  썸네일 (16:9)
                </div>
                <p className="mt-3 font-bold">{sermon.title}</p>
                <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                  {sermon.date}
                </p>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Button variant="secondary" disabled>
            더 보기
          </Button>
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-bold text-[var(--color-navy-900)] underline"
          >
            ▸ YouTube 채널 전체 보기
          </a>
        </div>
      </Section>
    </main>
  );
}
