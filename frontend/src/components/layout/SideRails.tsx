import Link from "next/link";
import { INSTAGRAM_URL, YOUTUBE_CHANNEL_URL } from "@/content/links";

/**
 * 화면 양옆에 고정되는 바로가기 (PM 요청 2026-09-01 — 모교회 뼈대 맞추기).
 *
 * 김해교회(`gloria.or.kr`)는 스크롤과 무관하게 **왼쪽에 SNS 세로 아이콘,
 * 오른쪽에 위치(핀) 버튼**을 띄워둔다. 두 가지가 사이트 어디서든 한 번에
 * 닿는다는 점이 이 뼈대의 핵심이라 같이 가져온다.
 *
 * ## `xl`(1280px) 이상에서만 그린다
 *
 * 좁은 화면에서는 **본문 위를 덮는다.** 컨테이너가 `max-w: 1200px`라
 * `lg`(1024px)에서는 좌우 여백이 0이고, 44px짜리 레일이 본문 글자를 가린다.
 * `xl`부터는 컨테이너 바깥에 40px씩 남아서 레일이 본문에 닿지 않는다.
 *
 * 모바일에서 감추는 이유도 같다 — 사진첩 그리드·주보 뷰어처럼 가로를 꽉 쓰는
 * 화면에서 버튼 두 개가 양옆을 먹으면 본문이 눌린다. 같은 링크가 헤더 메뉴와
 * 푸터에 모두 있으므로 잃는 것은 없다.
 *
 * ## 왜 서버 컴포넌트인가
 *
 * 상태가 없다. 링크 세 개가 전부고 `INSTAGRAM_URL`은 빌드 타임 상수다 —
 * 값이 `null`이면 이 항목은 번들에서 통째로 빠진다.
 */
export function SideRails() {
  return (
    <>
      {/* 왼쪽 — SNS */}
      <div
        className="fixed left-0 top-1/2 z-30 hidden -translate-y-1/2 flex-col rounded-r-[var(--radius-card)] bg-[var(--color-navy-900)] py-2 xl:flex"
      >
        <nav aria-label="SNS" className="flex flex-col">
          <a
            href={YOUTUBE_CHANNEL_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="YouTube 채널 (새 창)"
            title="YouTube"
            className="flex min-h-11 min-w-11 items-center justify-center text-xl text-white transition hover:bg-white/10"
          >
            <span aria-hidden>▶️</span>
          </a>
          {INSTAGRAM_URL && (
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram (새 창)"
              title="Instagram"
              className="flex min-h-11 min-w-11 items-center justify-center text-xl text-white transition hover:bg-white/10"
            >
              <span aria-hidden>📷</span>
            </a>
          )}
        </nav>
      </div>

      {/* 오른쪽 — 오시는 길 */}
      <div className="fixed right-0 top-1/2 z-30 hidden -translate-y-1/2 xl:block">
        <Link
          href="/location"
          aria-label="오시는 길"
          title="오시는 길"
          className="flex min-h-11 min-w-11 items-center justify-center rounded-l-[var(--radius-card)] bg-[var(--color-navy-900)] text-xl text-white transition hover:bg-[var(--color-navy-800)]"
        >
          <span aria-hidden>📍</span>
        </Link>
      </div>
    </>
  );
}
