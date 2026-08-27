"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
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
 * 공지 통합 목록 (PM 결정 2026-08-25).
 *
 * 공개 열람 전환으로 `NOTICE_PUBLIC`·`NOTICE_MEMBER`가 **둘 다 공개**가 되면서
 * 예전의 `/news`(공개만)와 `/notices`(전체)가 사실상 같은 화면이 됐다.
 * 두 목록을 유지하면 방문자가 "공지가 어디 있지"를 두 번 찾게 되므로 여기로
 * 합쳤다. 구분이 사라지는 건 아니고 **`회원 대상` 뱃지로 남긴다** — 누구를
 * 향해 쓴 글인지는 읽는 사람에게 여전히 유용한 정보다.
 *
 * 두 분류를 각각 조회해 `publishedAt` 최신순으로 합친다. 쿼리 키는 분류별로
 * 나뉘어 있어(`["posts", category]`) 다른 화면과 캐시를 공유한다.
 */
export function NoticeList() {
  const publicQuery = useQuery({
    queryKey: ["posts", "NOTICE_PUBLIC"],
    queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
  });
  const memberQuery = useQuery({
    queryKey: ["posts", "NOTICE_MEMBER"],
    queryFn: () => api.posts.list({ category: "NOTICE_MEMBER" }),
  });

  const isLoading = publicQuery.isLoading || memberQuery.isLoading;
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
                {/* 자물쇠가 아니다 — 공개돼 있고, '누구를 향한 글인지'만 표시한다 */}
                {item.category === "NOTICE_MEMBER" && (
                  <span className="rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-2 py-0.5 text-xs font-bold">
                    회원 대상
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
