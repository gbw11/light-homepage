"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { AlbumSummary } from "@/types/api";

/** 앨범 목록 쿼리 키 — 앨범 생성 후 무효화할 때 같은 키를 쓴다 */
export const ALBUMS_QUERY_KEY = ["albums"] as const;

/** `2026-08-19` → `8/19` (WIREFRAME §13-1의 "8/19 · 47장" 표기) */
function formatEventDate(date: string): string {
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${Number(month)}/${Number(day)}`;
}

export function AlbumList() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ALBUMS_QUERY_KEY,
    queryFn: () => api.albums.list(),
  });

  if (isLoading) {
    return <p className="text-[var(--color-gray-400)]">불러오는 중...</p>;
  }

  if (isError) {
    return (
      <p className="text-[var(--color-red-500)]">
        {isApiError(error) ? error.message : "앨범 목록을 불러오지 못했습니다."}
      </p>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return <p className="text-[var(--color-gray-400)]">등록된 앨범이 없습니다.</p>;
  }

  return (
    <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((album) => (
        <li key={album.id}>
          <AlbumCard album={album} />
        </li>
      ))}
    </ul>
  );
}

function AlbumCard({ album }: { album: AlbumSummary }) {
  return (
    <Link
      href={`/my/photos/${album.id}`}
      className="block overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-navy-100)] transition hover:bg-[var(--color-navy-100)]/40"
    >
      <AlbumCover album={album} />
      <div className="p-4">
        <p className="font-bold">{album.title}</p>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          {formatEventDate(album.eventDate)} · {album.photoCount}장
        </p>
      </div>
    </Link>
  );
}

/**
 * 커버 이미지. `coverThumbUrl`은 사진이 없는 앨범에서 null이므로
 * (SPEC_API §6.1) 깨진 `<img>` 대신 자리표시 블록을 렌더한다.
 *
 * mock은 `/photos/...` 로컬 경로를, 실제 백엔드는 R2 presigned URL을 준다.
 * 원본 크기를 알 수 없으므로 `fill` + 고정 비율 래퍼로 감싼다 — 원격 URL로
 * 바뀌어도 레이아웃이 그대로 유지된다.
 */
function AlbumCover({ album }: { album: AlbumSummary }) {
  if (!album.coverThumbUrl) {
    // 빈 커버는 불투명 `navy-100`을 쓴다. `/40`이면 반투명이라 배경색에 따라
    // 합성 결과가 달라져서(다크 스킴에서 #6e695d) 글자 대비를 보장할 수 없다.
    // navy-100 + navy-900은 두 값 모두 스킴과 무관하게 고정이라 어느 쪽에서도 11.7:1이다.
    return (
      <div className="flex aspect-[4/3] items-center justify-center bg-[var(--color-navy-100)]">
        <span className="text-sm text-[var(--color-ink)]">사진 없음</span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] bg-[var(--color-navy-100)]/40">
      {/* eslint-disable-next-line @next/next/no-img-element -- 실서비스 URL은 R2 presigned(만료·서명 포함)라 next/image 최적화 대상이 아니다 (COMPONENTS.md §6.1). remotePatterns에 없는 원격 URL이라 next/image에 넣으면 mock을 끄는 순간 400으로 깨진다. */}
      <img
        src={album.coverThumbUrl}
        alt={`${album.title} 커버 사진`}
        loading="lazy"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover"
      />
    </div>
  );
}
