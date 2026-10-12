"use client";

import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
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

/**
 * 두 분류를 합친 목록의 정렬 — **고정 글 먼저**, 그 안에서 `publishedAt` 최신순
 * (SPEC_API §3.2와 같은 규칙). 임시저장(publishedAt null)은 날짜가 없으니 맨 뒤.
 *
 * ⚠️ 2026-10-07 전에는 날짜로만 다시 정렬해서, 서버가 고정 글을 위로 보내도
 * 합치는 순간 순서가 깨졌다 — 📌는 붙는데 상단에 오지 않았다.
 */
export function sortNotices(items: PostSummary[]): PostSummary[] {
  return [...items].sort(compareNotices);
}

/** 음수면 `a`가 위 — `sortNotices`와 `mergeNoticeStreams`가 같은 기준을 쓴다 */
function compareNotices(a: PostSummary, b: PostSummary): number {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
  const pa = a.publishedAt ?? "";
  const pb = b.publishedAt ?? "";
  return pa === pb ? 0 : pa < pb ? 1 : -1;
}

/** 분류 하나를 지금까지 불러온 만큼 — 서버가 이미 `sortNotices`와 같은 순서로 준다 */
export type NoticeStream = { items: PostSummary[]; hasNext: boolean };

/**
 * 따로 페이지를 넘기는 두 분류(공개·회원)를 한 목록으로 합친다 (점검 🟠-5).
 *
 * 그냥 합쳐서 정렬하면 틀린다 — 공개 공지 2페이지에 회원 공지 1페이지보다 **새 글**이
 * 있을 수 있는데, 그게 "더 보기" 뒤에 목록 **중간**에 끼어든다. 그래서 아직 뒤가 남은
 * 분류의 마지막 글보다 아래에 올 글은 **그 분류를 더 불러올 때까지 보류**한다.
 * 이렇게 하면 이미 보인 순서가 바뀌지 않고, 새 글은 항상 아래에 이어 붙는다.
 *
 * `next` — "더 보기"가 불러와야 할 분류(보류를 만드는 쪽 = 마지막 글이 가장 위인 쪽).
 * 남은 게 없으면 `null`.
 */
export function mergeNoticeStreams(streams: NoticeStream[]): {
  visible: PostSummary[];
  next: number | null;
} {
  let next: number | null = null;
  let cutoff: PostSummary | null = null;
  for (const [i, stream] of streams.entries()) {
    const last = stream.items.at(-1);
    if (!stream.hasNext || !last) continue;
    if (cutoff === null || compareNotices(last, cutoff) < 0) {
      cutoff = last;
      next = i;
    }
  }
  const all = sortNotices(streams.flatMap((s) => s.items));
  const limit = cutoff;
  return {
    visible: limit === null ? all : all.filter((item) => compareNotices(item, limit) <= 0),
    next,
  };
}

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
 *   · 로그인 — 두 분류를 합쳐 `publishedAt` 최신순으로 섞어 보여준다
 *     (회원 전용 뱃지는 2026-09-16 PM 결정으로 뺐다 — `DECISIONS.md` 참고)
 *
 * 쿼리 키는 분류별(`["posts", category]`)이라 다른 화면과 캐시를 공유한다.
 */
export function NoticeList() {
  const { user, isLoading: isAuthLoading } = useAuth();
  // 키 끝의 "pages" — `/home`이 같은 분류를 `useQuery`로 읽어서 캐시 모양(`pages[]`)이
  // 다르다. 글 작성·고정 후의 `["posts"]` 무효화는 그대로 닿는다
  const publicQuery = useInfiniteQuery({
    queryKey: ["posts", "NOTICE_PUBLIC", "pages"],
    queryFn: ({ pageParam }) => api.posts.list({ category: "NOTICE_PUBLIC", page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
  });
  const memberQuery = useInfiniteQuery({
    queryKey: ["posts", "NOTICE_MEMBER", "pages"],
    queryFn: ({ pageParam }) => api.posts.list({ category: "NOTICE_MEMBER", page: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
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

  // 비로그인이면 회원 공지는 빼고 합친다 — 조회를 꺼도(`enabled`) 로그아웃 전 캐시가
  // 남아 있을 수 있어서, 데이터 유무가 아니라 로그인 여부로 정한다
  const queries = user ? [publicQuery, memberQuery] : [publicQuery];
  const { visible: items, next } = mergeNoticeStreams(
    queries.map((query) => {
      const pages = query.data?.pages ?? [];
      return {
        items: pages.flatMap((p) => p.items),
        hasNext: pages.at(-1)?.hasNext ?? false,
      };
    }),
  );
  const isFetchingMore = queries.some((query) => query.isFetchingNextPage);

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
      <LoadMoreButton
        hasNextPage={next !== null}
        isFetching={isFetchingMore}
        onClick={() => {
          if (next !== null) void queries[next].fetchNextPage();
        }}
      />
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
