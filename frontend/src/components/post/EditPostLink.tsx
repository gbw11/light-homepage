"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";

/**
 * 글 상세에서 `/admin/posts/[id]/edit`으로 가는 임원 전용 진입점.
 *
 * 상세 화면 셋(`/news/[slug]` · `/my/notices/[slug]` · `/my/documents/[slug]`)
 * 중 앞의 둘은 서버 컴포넌트라 역할을 볼 수 없다. 그래서 이 조각만
 * 클라이언트로 떼어냈다 — 페이지 전체를 클라이언트로 바꾸면 공개 공지의
 * SSR/SEO를 잃는다.
 *
 * ⚠️ 링크를 숨기는 것은 **보안이 아니라 편의**다 (WORKPLAN §5.1). 권한 없는
 * 사용자가 URL을 직접 쳐도 `RequireLeader`가 막고, 그마저도 UI일 뿐이며
 * 최종 판단은 서버가 한다 (SPEC_API §3.5는 권한 `L`).
 */
export function EditPostLink({ postId }: { postId: string }) {
  const { user } = useAuth();

  // 로딩 중에도 아무것도 그리지 않는다 — 링크가 떴다 사라지면 눈에 거슬린다
  if (!user || !isLeaderOrAbove(user.role)) return null;

  return (
    <Link
      href={`/admin/posts/${postId}/edit`}
      className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)]"
    >
      ✎ 수정
    </Link>
  );
}
