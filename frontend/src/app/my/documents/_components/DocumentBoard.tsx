"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import { useAuth } from "@/components/providers/AuthProvider";
import type { PostCategory, PostSummary } from "@/types/api";

/**
 * 이 화면이 다루는 분류. **열람 권한이 서로 다르다** (PM 결정 2026-08-25):
 * 회의록은 공개, 예산안은 임원 이상 — 헌금·지출 내역이 담기기 때문이다.
 * `leaderOnly`가 그 차이를 표시하고, 탭 노출·조회가 모두 이 값을 따른다.
 */
const TABS = [
  { category: "MINUTES", label: "회의록", leaderOnly: false },
  { category: "BUDGET", label: "예산안", leaderOnly: true },
] as const satisfies readonly {
  category: PostCategory;
  label: string;
  leaderOnly: boolean;
}[];

type DocumentCategory = (typeof TABS)[number]["category"];

/** 임시저장(`publish: false`) 글은 `publishedAt`이 null이다 (SPEC_API §3.4) */
function formatDate(iso: string | null): string {
  if (!iso) return "임시저장";
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * 회의록·예산안 목록 — 분류 탭으로 전환한다 (FR-DOC-03/04).
 * 쿼리 키는 `/news`·`/my/notices`와 같은 `["posts", category]` 규칙을
 * 그대로 쓴다 (TanStack Query 캐시 공유).
 *
 * 탭 전환은 URL을 바꾸지 않는다 — 문서 목록은 공유·북마크할 대상이 아니고
 * (권한 있는 사람만 열람), 링크로 오갈 필요가 있는 건 개별 문서 상세다.
 */
export function DocumentBoard() {
  const [category, setCategory] = useState<DocumentCategory>("MINUTES");
  const { user } = useAuth();
  const isLeader = !!user && isLeaderOrAbove(user.role);
  // 권한이 없으면 예산안 탭 자체를 렌더하지 않는다 — 눌러봤자 403이고,
  // 잠긴 탭을 보여주는 건 "여기 뭔가 있다"는 정보만 준다.
  const tabs = TABS.filter((tab) => !tab.leaderOnly || isLeader);

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
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["posts", category],
    queryFn: () => api.posts.list({ category }),
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

  const items: PostSummary[] = data?.items ?? [];

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
              href={`/my/documents/${item.slug}`}
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
    </Section>
  );
}
