"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** `2026-08-16T...` → `2026.08.16` */
function formatDot(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}.${mm}.${dd}`;
}

/**
 * HOME "최근 말씀" 카드 (FR-PUB-01).
 *
 * `/sermons`와 **같은 쿼리 키**(`["sermons"]`)를 쓰지 않는다 — 그쪽은
 * `useInfiniteQuery`라 캐시 모양(`pages[]`)이 다르다. 여기서는 1편만
 * 필요하므로 `size: 1`로 따로 받는다. 전송량이 작고 목록 화면과 서로를
 * 무효화하지 않는다.
 *
 * ⚠️ 서버에서 가져오지 않는 이유는 `WeeklyNotices` 주석과 같다.
 */
export function RecentSermon() {
  const { data, isLoading } = useQuery({
    queryKey: ["sermons", "latest"],
    queryFn: () => api.sermons.list({ page: 0, size: 1 }),
  });
  const [thumbFailed, setThumbFailed] = useState(false);

  const sermon = data?.items[0];

  // 로딩·실패·빈 목록에서는 카드를 비워두지 않고 아무것도 렌더하지 않는다.
  // 아래 "지난 말씀 전체보기" 링크가 남아 있어 길이 끊기지 않는다.
  if (isLoading || !sermon) return null;

  return (
    <a
      href={sermon.youtubeUrl}
      target="_blank"
      rel="noreferrer"
      className="block max-w-sm rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 transition hover:opacity-90 md:max-w-none"
    >
      {thumbFailed ? (
        <div
          aria-hidden
          className="flex aspect-video items-center justify-center rounded-[var(--radius-card)] bg-[var(--color-navy-100)] text-sm text-[var(--color-ink)]"
        >
          ▶ 영상 보기
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- YouTube CDN 이미지 (SermonList와 같은 이유)
        <img
          src={sermon.thumbnailUrl}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setThumbFailed(true)}
          className="aspect-video w-full rounded-[var(--radius-card)] bg-[var(--color-navy-100)] object-cover"
        />
      )}
      <p className="mt-4 font-bold">{sermon.title}</p>
      <p className="text-sm text-[var(--color-gray-400)]">{formatDot(sermon.publishedAt)}</p>
    </a>
  );
}
