import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { YOUTUBE_CHANNEL_URL } from "@/content/links";
import { SermonList } from "./_components/SermonList";

export const metadata: Metadata = {
  title: "말씀",
  description: "LIGHT 청년교회 YouTube 채널의 설교 영상 목록입니다.",
};

/**
 * WIREFRAME.md §5 `/sermons` — FR-PUB-09.
 *
 * 목록은 `SermonList`(클라이언트)가 `api.sermons.list`로 가져온다. 예전에는 이
 * 파일이 더미 배열을 직접 들고 있었는데, 화면이 자기 데이터를 들고 있으면
 * 실제 API가 붙는 날 화면까지 함께 고쳐야 한다. 지금은 데이터가 mock 계층에
 * 있고 화면은 계약만 안다.
 *
 * ⚠️ 설교 목록은 **백엔드가 YouTube Data API를 프록시**해서 준다 — API 키를
 * 클라이언트에 실을 수 없기 때문이다 (`types/api.ts`의 `Sermon` 주석).
 * 아직 백엔드 계약이 확정되지 않았다 (`BACKEND_HANDOFF.md` 참고).
 */
export default function SermonsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="pb-8 md:pb-8">
        <h1 className="text-2xl font-bold md:text-3xl">말씀</h1>
      </Section>

      <SermonList />

      <Section className="pt-0">
        <div className="flex justify-center">
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-ink)] underline"
          >
            ▸ YouTube 채널 전체 보기
          </a>
        </div>
      </Section>
    </main>
  );
}
