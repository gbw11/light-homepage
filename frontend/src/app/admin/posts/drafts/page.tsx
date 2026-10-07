import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { DraftList } from "./_components/DraftList";

export const metadata: Metadata = {
  title: "임시저장 글",
  robots: { index: false, follow: false },
};

/**
 * 임시저장 글 `/admin/posts/drafts` (SPEC_API §3.6, PM 요청 2026-10-07).
 *
 * 공개 목록·상세는 임시저장 글을 빼므로, 예전에는 임시저장한 글을 **다시 열
 * 길이 없었다** (사용자 흐름 점검 2026-10-07 🔴-2). 여기서 찾아 수정 화면으로
 * 들어가 이어 쓰거나 게시한다. 권한은 글쓰기와 같은 `L` 이상이다.
 */
export default function DraftsPage() {
  return (
    <RequireLeader description="임시저장 글은 임원 이상만 볼 수 있습니다.">
      <main id="main" tabIndex={-1}>
        <Section>
          <Link
            href="/admin"
            className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
          >
            ← 관리 홈
          </Link>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">임시저장 글</h1>
          <p className="mt-2 text-sm text-[var(--color-gray-400)]">
            아직 공개되지 않은 글입니다. 눌러서 이어 쓰거나 게시하세요. 다른 임원이 저장한 글도 보입니다.
          </p>

          <div className="mt-8">
            <DraftList />
          </div>
        </Section>
      </main>
    </RequireLeader>
  );
}
