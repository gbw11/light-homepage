"use client";

import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import type { Sermon } from "@/types/api";

/**
 * 한 번에 12편 — **한 행 4개짜리 격자에서 정확히 3줄**로 떨어진다 (PM 사양:
 * 각 행에 4개). 나누어떨어지지 않는 수를 쓰면 마지막 줄이 비뚤게 남는다.
 */
const PAGE_SIZE = 12;

/**
 * 목록과 로딩 자리표시자가 **같은 격자**를 써야 한다 — 다르면 로딩이 끝나는
 * 순간 레이아웃이 다시 움직인다. 예전 말씀 목록이 사이트에서 CLS가 가장
 * 심했던 자리(0.537)였고, 원인이 정확히 이것이었다.
 */
const GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-4";

/** `2026-08-30T05:00:00Z` → `2026. 8. 30.` */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}.`;
}

/**
 * 썸네일. 영상이 비공개로 바뀌거나 지워지면 404가 오므로 깨진 이미지 대신
 * 자리표시자로 넘어간다. 16:9는 성공·실패와 무관하게 유지된다 (COMPONENTS.md §6.3).
 */
function Thumbnail({ src }: { src: string }) {
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
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-[var(--radius-card)] bg-[var(--color-navy-100)] object-cover"
    />
  );
}

function SermonCard({ sermon }: { sermon: Sermon }) {
  return (
    <a
      href={sermon.youtubeUrl}
      target="_blank"
      rel="noreferrer"
      className="block rounded-[var(--radius-card)] transition hover:opacity-90"
    >
      <Thumbnail src={sermon.thumbnailUrl} />
      <p className="mt-3 font-bold">{sermon.title}</p>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        {formatDate(sermon.publishedAt)}
      </p>
    </a>
  );
}

function ArchiveSkeleton() {
  return (
    <ul className={GRID} aria-hidden="true">
      {Array.from({ length: PAGE_SIZE }, (_, i) => (
        <li key={i}>
          <div className="aspect-video rounded-[var(--radius-card)] bg-[var(--color-navy-100)]/50" />
          <div className="mt-3 h-6 w-5/6 rounded bg-[var(--color-navy-100)]/60" />
          <div className="mt-1 h-5 w-1/3 rounded bg-[var(--color-navy-100)]/40" />
        </li>
      ))}
    </ul>
  );
}

/**
 * `/sermons/all` — 지난 말씀 전체보기 (PM 요청 2026-09-01).
 *
 * ## `/sermons`와 어떻게 다른가
 *
 * `/sermons`는 **지금 예배를 보러 온 사람**을 위한 화면이다 — 라이브이거나,
 * 아니면 최신 4편. 이 화면은 **지난 것을 훑으러 온 사람**을 위한 곳이라
 * 격자를 계속 이어 붙인다. 목적이 달라서 화면을 나눴다.
 *
 * ## 우리가 가진 만큼만 보여주고, 나머지는 채널로 보낸다
 *
 * 목록의 출처는 채널 RSS라 **최신 15편**이 상한이다(`app/sermons/feed/route.ts`).
 * 210편 전부를 여기서 넘기게 만들 수도 있었지만, 그러려면 YouTube Data API
 * 키·쿼터 관리가 따라온다. 이 화면이 하는 일에 비해 값이 비싸다.
 *
 * 그래서 **가진 만큼 다 보여준 뒤 "유튜브로 바로가기"로 넘긴다.** 마지막
 * 페이지에 도달하면 그 버튼이 목록 끝에 붙는다 — 사용자가 "여기까지가
 * 끝이구나"를 알고 다음 행동을 고를 수 있다.
 */
export function SermonArchive() {
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["sermons", "archive"],
      queryFn: ({ pageParam }) => api.sermons.list({ page: pageParam, size: PAGE_SIZE }),
      initialPageParam: 0,
      getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    });

  if (isLoading) {
    return (
      <Section className="pt-0">
        <ArchiveSkeleton />
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
      <ul className={GRID}>
        {sermons.map((sermon) => (
          <li key={sermon.id}>
            <SermonCard sermon={sermon} />
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
