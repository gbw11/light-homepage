import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  robots: { index: false, follow: false },
};

/**
 * 한글 404 화면 (점검 🔵-2). 없는 주소, 그리고 `notFound()`를 부른 화면
 * (없는 공지 `/news/[slug]` 등)이 여기로 온다 — 응답 코드도 404다.
 *
 * 서버 컴포넌트로 둔다 — 데이터 없이 정적이라 클라이언트 JS가 필요 없다.
 */
export default function NotFound() {
  return (
    <main id="main" tabIndex={-1}>
      <Section className="text-center">
        <div className="mx-auto max-w-sm space-y-6">
          <h1 className="text-xl font-bold">페이지를 찾을 수 없습니다</h1>
          <p className="leading-relaxed text-[var(--color-gray-400)]">
            주소가 바뀌었거나 삭제된 글일 수 있습니다.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
            >
              홈으로
            </Link>
            <Link
              href="/news"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold text-[var(--color-ink)] transition hover:brightness-95"
            >
              소식 보기
            </Link>
          </div>
        </div>
      </Section>
    </main>
  );
}
