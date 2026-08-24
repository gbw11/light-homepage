"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";

/** 임시저장(`publish: false`) 글은 `publishedAt`이 null이다 (SPEC_API §3.4) */
function formatDate(iso: string | null): string {
  if (!iso) return "임시저장";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 공지(공개) 목록 — `posts.list({ category: "NOTICE_PUBLIC" })`.
 * mock이 `pinned` 우선 정렬을 이미 보장하므로 그대로 렌더한다 (SPEC_API §3.2).
 */
export function NoticeList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["posts", "NOTICE_PUBLIC"],
    queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
  });

  if (isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-red-500)]">
          {isApiError(error) ? error.message : "목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const items = data?.items ?? [];

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
              href={`/news/${item.slug}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <span className="flex items-center gap-2">
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
