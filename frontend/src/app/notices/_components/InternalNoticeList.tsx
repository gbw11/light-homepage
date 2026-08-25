"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { PostSummary } from "@/types/api";

/** 임시저장(`publish: false`) 글은 `publishedAt`이 null이다 (SPEC_API §3.4) */
function formatDate(iso: string | null): string {
  if (!iso) return "임시저장";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 내부 공지 통합 목록 — WIREFRAME.md §14 `/notices`.
 * `NOTICE_PUBLIC` + `NOTICE_MEMBER` 두 분류를 각각 조회한 뒤 하나의 목록으로
 * 합쳐서 `publishedAt` 최신순으로 정렬한다. 내부(`NOTICE_MEMBER`) 글에는
 * 🔒 표시를 붙인다 (공개 글의 📌 고정 표시와 별개).
 *
 * 두 쿼리는 `NoticeList`(공개 `/news`)가 쓰는 것과 동일한 쿼리 키
 * (`["posts", "NOTICE_PUBLIC"]`)를 그대로 재사용한다 — TanStack Query가
 * 캐시를 공유하므로 `/news`를 먼저 방문했다면 중복 요청이 없다.
 */
export function InternalNoticeList() {
  const publicQuery = useQuery({
    queryKey: ["posts", "NOTICE_PUBLIC"],
    queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
  });
  const memberQuery = useQuery({
    queryKey: ["posts", "NOTICE_MEMBER"],
    queryFn: () => api.posts.list({ category: "NOTICE_MEMBER" }),
  });

  if (publicQuery.isLoading || memberQuery.isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (publicQuery.isError || memberQuery.isError) {
    const error = publicQuery.error ?? memberQuery.error;
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-red-500)]">
          {isApiError(error) ? error.message : "목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  // 임시저장(publishedAt null)은 날짜가 없으니 목록 맨 뒤로 보낸다
  const items: PostSummary[] = [
    ...(publicQuery.data?.items ?? []),
    ...(memberQuery.data?.items ?? []),
  ].sort((a, b) => ((a.publishedAt ?? "") < (b.publishedAt ?? "") ? 1 : -1));

  if (items.length === 0) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">등록된 공지가 없습니다.</p>
      </Section>
    );
  }

  return (
    <Section className="pt-8">
      <ul className="divide-y divide-[var(--color-navy-100)]">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/notices/${item.slug}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <span className="flex items-center gap-2">
                {item.category === "NOTICE_MEMBER" && <span aria-label="내부 공지">🔒</span>}
                {item.pinned && <span aria-label="고정됨">📌</span>}
                <span className="font-bold">{item.title}</span>
              </span>
              <span className="shrink-0 text-sm text-[var(--color-gray-400)]">
                {formatDate(item.publishedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
