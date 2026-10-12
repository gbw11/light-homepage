"use client";

import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import { useAuth } from "@/components/providers/AuthProvider";
import type { PostCategory, PostSummary } from "@/types/api";

/**
 * 이 화면이 다루는 분류. **열람 권한이 서로 다르다** (SPEC_API §3.1 v1.3):
 * 회의록은 회원(페이지 진입을 MemberGate가 막는다), 예산안은 임원 이상 —
 * 헌금·지출 내역이 담기기 때문이다. `leaderOnly`가 그 차이를 표시하고,
 * 탭 노출·조회가 모두 이 값을 따른다.
 */
const TABS = [
  { category: "MINUTES", label: "회의록", leaderOnly: false },
  { category: "BUDGET", label: "예산안", leaderOnly: true },
] as const satisfies readonly {
  category: PostCategory;
  label: string;
  leaderOnly: boolean;
}[];

export type DocumentCategory = (typeof TABS)[number]["category"];

/**
 * `/documents?tab=budget` → 예산안 탭으로 연다 (관리 홈 "예산안" 링크).
 * 알 수 없는 값·없음은 기본 탭(회의록)이다.
 */
export function parseDocumentTab(tab: string | string[] | undefined): DocumentCategory {
  return tab === "budget" ? "BUDGET" : "MINUTES";
}

/** 임시저장(`publish: false`) 글은 `publishedAt`이 null이다 (SPEC_API §3.4) */
function formatDate(iso: string | null): string {
  if (!iso) return "임시저장";
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * 회의록·예산안 목록 — 분류 탭으로 전환한다 (FR-DOC-03/04).
 * 쿼리 키는 `/news`와 같은 `["posts", category, "pages"]` 규칙을
 * 그대로 쓴다 (TanStack Query 캐시 공유).
 *
 * 탭 전환은 URL을 바꾸지 않는다 — 문서 목록은 공유·북마크할 대상이 아니고
 * (권한 있는 사람만 열람), 링크로 오갈 필요가 있는 건 개별 문서 상세다.
 * 다만 **처음 열 탭**은 `initialCategory`로 받는다 — 관리 홈의 "예산안"
 * 링크가 회의록 탭으로 열리던 문제(USERFLOW_AUDIT 🔵-11) 때문이다.
 */
export function DocumentBoard({
  initialCategory = "MINUTES",
}: {
  initialCategory?: DocumentCategory;
}) {
  const [selected, setCategory] = useState<DocumentCategory>(initialCategory);
  const { user } = useAuth();
  const isLeader = !!user && isLeaderOrAbove(user.role);
  // 권한이 없으면 예산안 탭 자체를 렌더하지 않는다 — 눌러봤자 403이고,
  // 잠긴 탭을 보여주는 건 "여기 뭔가 있다"는 정보만 준다.
  const tabs = TABS.filter((tab) => !tab.leaderOnly || isLeader);
  // `?tab=budget`으로 들어온 일반 회원은 보이는 탭(회의록)으로 되돌린다
  const category = tabs.some((tab) => tab.category === selected) ? selected : "MINUTES";

  return (
    <>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 md:px-10">
        <div
          className="mt-6 flex gap-2 border-b border-[var(--color-navy-100)]"
          role="tablist"
          aria-label="문서 분류"
        >
          {tabs.map((tab) => {
            const active = tab.category === category;
            return (
              <button
                key={tab.category}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setCategory(tab.category)}
                className={
                  active
                    ? "border-b-2 border-[var(--color-navy-900)] px-4 py-3 text-sm font-bold"
                    : "px-4 py-3 text-sm font-bold text-[var(--color-gray-400)]"
                }
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <DocumentList category={category} />
    </>
  );
}

function DocumentList({ category }: { category: DocumentCategory }) {
  // 키 끝의 "pages" — 같은 분류를 `useQuery`로 읽는 화면과 캐시 모양(`pages[]`)이
  // 달라서 키를 나눈다. 글 작성·수정 후의 `["posts"]` 무효화는 그대로 닿는다.
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["posts", category, "pages"],
      queryFn: ({ pageParam }) => api.posts.list({ category, page: pageParam }),
      initialPageParam: 0,
      // 21번째 글부터는 "더 보기"로 이어 붙인다 (점검 2026-10-07 🟠-5, SPEC_API §1.6)
      getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    });

  if (isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError) {
    // 서버는 권한 없는 사용자에게 FORBIDDEN을 돌려준다 (SPEC_API §3.2) —
    // UI 게이트를 통과했어도 최종 판단은 서버 몫이라 그 경우를 따로 안내한다.
    const forbidden = isApiError(error) && error.code === "FORBIDDEN";
    return (
      <Section className="pt-8">
        <p role="alert" className="text-[var(--color-red-500)]">
          {forbidden
            ? "이 문서를 열람할 권한이 없습니다."
            : isApiError(error)
              ? error.message
              : "목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const items: PostSummary[] = data?.pages.flatMap((p) => p.items) ?? [];

  if (items.length === 0) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">등록된 문서가 없습니다.</p>
      </Section>
    );
  }

  return (
    <Section className="pt-8">
      <ul className="divide-y divide-[var(--color-navy-100)]">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/documents/${item.slug}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <span className="flex items-center gap-2">
                {item.pinned && <span aria-label="고정됨">📌</span>}
                <span className="font-bold">{item.title}</span>
                {item.attachmentCount > 0 && (
                  <span
                    className="text-sm text-[var(--color-gray-400)]"
                    aria-label={`첨부 ${item.attachmentCount}개`}
                  >
                    📎 {item.attachmentCount}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm text-[var(--color-gray-400)]">
                {formatDate(item.publishedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <LoadMoreButton
        hasNextPage={hasNextPage}
        isFetching={isFetchingNextPage}
        onClick={() => fetchNextPage()}
      />
    </Section>
  );
}
