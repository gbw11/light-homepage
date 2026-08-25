"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { Sermon } from "@/types/api";

/** 한 번에 12편 — 3열 그리드에서 4줄로 떨어진다 */
const PAGE_SIZE = 12;

/** `2026-08-16T05:00:00Z` → `2026. 8. 16.` */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * 설교 영상 썸네일.
 *
 * YouTube CDN 이미지라 우리가 통제할 수 없다 — 영상이 비공개로 바뀌거나
 * 지워지면 404가 온다. 그때 깨진 이미지 아이콘을 보여주는 대신 자리표시자로
 * 넘어간다. 16:9 비율은 로드 성공·실패와 무관하게 유지되므로 레이아웃이
 * 튀지 않는다 (COMPONENTS.md §6.3).
 */
function Thumbnail({ sermon }: { sermon: Sermon }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        aria-hidden
        className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]"
      >
        ▶ 영상 보기
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- YouTube CDN 이미지다. next/image에 넣으면 remotePatterns 설정이 필요하고 우리 서버가 남의 이미지를 재가공·캐시하게 된다 (COMPONENTS.md §6.1)
    <img
      src={sermon.thumbnailUrl}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-[var(--radius-card)] bg-[var(--color-navy-100)] object-cover"
    />
  );
}

/**
 * WIREFRAME.md §5 · FR-PUB-09 — 설교 영상 목록.
 *
 * 카드를 누르면 YouTube로 새 탭 이동한다 (자체 플레이어 없음 — 스펙).
 * 설교자·본문 정보는 표시하지 않는다 (YouTube 메타데이터에 없다).
 *
 * ⚠️ **서버에서 prefetch하지 않는다.** `/news`가 같은 실수를 했다가 되돌렸다 —
 * 백엔드가 없는 환경에서 정적 생성이 응답을 기다리다 빌드가 죽는다
 * (`app/news/page.tsx` 주석). 목록은 브라우저에서만 조회한다.
 */
export function SermonList() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["sermons"],
      queryFn: ({ pageParam }) => api.sermons.list({ page: pageParam, size: PAGE_SIZE }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    });

  if (isLoading) {
    return (
      <Section className="pt-0">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError) {
    return (
      <Section className="pt-0">
        <p role="alert" className="text-[var(--color-red-500)]">
          {isApiError(error) ? error.message : "설교 목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const sermons = data?.pages.flatMap((p) => p.items) ?? [];

  if (sermons.length === 0) {
    return (
      <Section className="pt-0">
        <p className="text-[var(--color-gray-400)]">아직 등록된 영상이 없습니다.</p>
      </Section>
    );
  }

  return (
    <Section className="pt-0">
      <ul className="grid gap-6 md:grid-cols-3">
        {sermons.map((sermon) => (
          <li key={sermon.id}>
            <a
              href={sermon.youtubeUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-[var(--radius-card)] transition hover:opacity-90"
            >
              <Thumbnail sermon={sermon} />
              <p className="mt-3 font-bold">{sermon.title}</p>
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                {formatDate(sermon.publishedAt)}
              </p>
            </a>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <div className="mt-10 flex justify-center">
          <Button
            variant="secondary"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      )}
    </Section>
  );
}
