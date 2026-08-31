"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { useAuth } from "@/components/providers/AuthProvider";
import type { PostSummary } from "@/types/api";

/** 목록과 스켈레톤이 같은 구분선·간격을 써야 로딩 후 다시 움직이지 않는다 */
const NOTICE_LIST = "divide-y divide-[var(--color-navy-100)]";

/**
 * 스켈레톤에 그릴 줄 수.
 *
 * ⚠️ 여기는 **정확히 맞출 수 없는 경우**다 — 공지 수는 서버가 정하고(분류 2개 ×
 * 기본 20건) 화면은 응답 전까지 알 수 없다. 실제보다 적게 잡으면 늘어나면서,
 * 많이 잡으면 줄어들면서 움직인다. 6은 "한 화면에 흔히 보이는 공지 수"로,
 * 아무것도 예약하지 않는 것(한 줄)보다 확실히 낫다는 선이다.
 */
const SKELETON_ROWS = 6;

/** 임시저장(`publish: false`) 글은 `publishedAt`이 null이다 (SPEC_API §3.4) */
function formatDate(iso: string | null): string {
  if (!iso) return "임시저장";
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 공지 통합 목록 — 한 화면, 두 분류.
 *
 * 2026-08-31 확정(SPEC_API §3.1 v1.3)으로 `NOTICE_MEMBER`가 다시 **회원
 * 전용**이 됐다. 화면은 하나로 유지하되:
 *   · 비로그인 — `NOTICE_PUBLIC`만 조회한다 (`enabled`). 회원 공지를
 *     조회하면 서버가 401을 주는데, 그걸 목록 전체의 에러로 보여줄 이유가
 *     없다 — 대신 하단에 로그인 안내 한 줄을 남긴다
 *   · 로그인 — 두 분류를 합쳐 `publishedAt` 최신순. `🔒 회원` 뱃지로 구분
 *
 * 쿼리 키는 분류별(`["posts", category]`)이라 다른 화면과 캐시를 공유한다.
 */
export function NoticeList() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const publicQuery = useQuery({
    queryKey: ["posts", "NOTICE_PUBLIC"],
    queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
  });
  const memberQuery = useQuery({
    queryKey: ["posts", "NOTICE_MEMBER"],
    queryFn: () => api.posts.list({ category: "NOTICE_MEMBER" }),
    // 회원 전용 — 비로그인 상태에서는 조회 자체를 하지 않는다 (서버는 401을 준다)
    enabled: !!user,
  });

  const isLoading = publicQuery.isLoading || isAuthLoading || (!!user && memberQuery.isLoading);
  const isError = publicQuery.isError || memberQuery.isError;
  const error = publicQuery.error ?? memberQuery.error;

  if (isLoading) {
    return <NoticeListSkeleton />;
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
      <ul className={NOTICE_LIST}>
        {items.map((item) => (
          <li key={item.id}>
            <Link
              href={`/news/${item.slug}`}
              className="flex items-center justify-between gap-4 py-4"
            >
              <span className="flex items-center gap-2">
                {/* 회원 전용 표시 (SPEC_API §3.1 v1.3) — 목록에 섞여 있어도 구분된다 */}
                {item.category === "NOTICE_MEMBER" && (
                  <span className="rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-2 py-0.5 text-xs font-bold">
                    🔒 회원
                  </span>
                )}
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
      {!user && (
        <p className="mt-6 text-sm text-[var(--color-gray-400)]">
          🔒 회원 공지는 로그인하면 볼 수 있습니다.
        </p>
      )}
    </Section>
  );
}

/** 목록이 도착하기 전 자리를 잡아두는 줄들 (`SKELETON_ROWS` 주석 참고) */
function NoticeListSkeleton() {
  return (
    <Section className="pt-8">
      <ul className={NOTICE_LIST} aria-hidden="true">
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          // 실제 줄과 같은 `py-4` + 24px 본문 높이
          <li key={i} className="flex items-center justify-between gap-4 py-4">
            <span className="h-6 w-1/2 rounded bg-[var(--color-navy-100)]/60" />
            <span className="h-5 w-10 shrink-0 rounded bg-[var(--color-navy-100)]/40" />
          </li>
        ))}
      </ul>
    </Section>
  );
}
