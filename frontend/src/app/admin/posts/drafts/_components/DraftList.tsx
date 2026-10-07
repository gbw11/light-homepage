"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { PostCategory, PostSummary } from "@/types/api";

/** PostForm의 분류 라벨과 같은 말을 쓴다 — 작성 화면에서 고른 이름 그대로 보이게 */
const CATEGORY_LABEL: Record<PostCategory, string> = {
  NOTICE_PUBLIC: "공지(공개)",
  NOTICE_MEMBER: "공지(회원)",
  MINUTES: "회의록",
  BUDGET: "예산안",
};

/**
 * 임시저장 글 목록 (SPEC_API §3.6). 누르면 수정 화면 — 거기서 [게시]하면 공개되고
 * 이 목록에서 빠진다.
 *
 * `staleTime: 0` — 방금 저장·게시한 결과가 바로 반영돼야 한다. 옛 캐시가 보이면
 * "게시했는데 아직 임시저장에 있다"로 오해한다.
 */
export function DraftList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["posts", "drafts"],
      queryFn: ({ pageParam }) => api.posts.drafts({ page: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
      staleTime: 0,
    });

  if (isLoading) {
    return <p className="text-[var(--color-gray-400)]">불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p role="alert" className="text-[var(--color-red-500)]">
        {isApiError(error) ? error.message : "임시저장 글을 불러오지 못했습니다."}
      </p>
    );
  }

  const items: PostSummary[] = data?.pages.flatMap((p) => p.items) ?? [];

  if (items.length === 0) {
    return (
      <div>
        <p className="text-[var(--color-gray-400)]">임시저장한 글이 없습니다.</p>
        <Link
          href="/admin/posts/new"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-bold hover:underline"
        >
          ▸ 새 글 쓰기
        </Link>
      </div>
    );
  }

  return (
    <div>
      <ul className="divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
        {items.map((post) => (
          <li key={post.id}>
            <Link
              href={`/admin/posts/${encodeURIComponent(post.id)}/edit`}
              className="flex items-center justify-between gap-4 py-4 hover:bg-[var(--color-navy-100)]/40"
            >
              <span className="min-w-0">
                <span className="mr-2 rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-2 py-0.5 text-xs font-bold">
                  {CATEGORY_LABEL[post.category]}
                </span>
                <span className="font-bold">{post.title}</span>
                {post.attachmentCount > 0 && (
                  <span className="ml-2 text-sm text-[var(--color-gray-400)]">📎 {post.attachmentCount}</span>
                )}
              </span>
              <span className="shrink-0 text-sm text-[var(--color-gray-400)]">
                {post.authorName} · 이어 쓰기 ›
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      )}
    </div>
  );
}
