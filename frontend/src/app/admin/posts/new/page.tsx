import type { Metadata } from "next";
import Link from "next/link";
import { Section } from "@/components/ui/Section";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { PostForm } from "./_components/PostForm";

export const metadata: Metadata = {
  title: "글 작성 | LIGHT",
  // 관리 화면은 검색 결과에 나올 이유가 없다 (권한이 있어야 열리는 화면)
  robots: { index: false, follow: false },
};

/**
 * WIREFRAME.md §16 — 글 작성 `/admin/posts/new` (FR-DOC-01, SPEC_API §3.4).
 *
 * 공지·회의록·예산안을 **분류 드롭다운 하나로** 통합한 화면이다
 * (WIREFRAME.md §22 결정 8). 권한은 전부 `L` 이상이다 (SPEC_API §3.1).
 */
export default function NewPostPage() {
  return (
    <RequireLeader>
      <main>
        <Section>
          <Link
            href="/my"
            className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-navy-900)]"
          >
            ← 나의 LIGHT
          </Link>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">글 작성</h1>

          <div className="mt-8">
            <PostForm />
          </div>
        </Section>
      </main>
    </RequireLeader>
  );
}
