"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/** `2026-08-24` → `8월 24일` */
function formatServiceDate(date: string): string {
  const [, month, day] = date.split("-");
  if (!month || !day) return date;
  return `${Number(month)}월 ${Number(day)}일`;
}

/**
 * 이번 주 주보 미리보기 (FR-MEM-01).
 *
 * `/bulletin`과 **같은 쿼리 키**(`["bulletins", "latest"]`)를 쓴다 — 주보 화면을
 * 거쳐 왔다면 추가 요청이 없다.
 */
function BulletinPreview() {
  const { data: bulletin, isLoading } = useQuery({
    queryKey: ["bulletins", "latest"],
    queryFn: () => api.bulletins.latest(),
  });

  if (isLoading || !bulletin) return null;

  const first = bulletin.pages[0];

  return (
    <Link
      href="/bulletin"
      className="flex gap-4 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 transition hover:bg-[var(--color-navy-100)]/40"
    >
      {first && (
        // eslint-disable-next-line @next/next/no-img-element -- 실서비스 URL은 R2 presigned(만료·서명 포함)라 next/image 최적화 대상이 아니다 (COMPONENTS.md §6.1)
        <img
          src={first.url}
          alt=""
          width={first.width}
          height={first.height}
          loading="lazy"
          decoding="async"
          className="h-20 w-16 shrink-0 rounded-[4px] bg-[var(--color-navy-100)] object-cover"
        />
      )}
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-gray-400)]">이번 주 주보</p>
        <p className="mt-1 font-bold">{formatServiceDate(bulletin.serviceDate)}</p>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          {bulletin.pages.length}면
        </p>
      </div>
    </Link>
  );
}

/**
 * 최근 앨범 미리보기 (FR-MEM-01).
 *
 * `/photos`와 같은 쿼리 키(`["albums", "list"]`)라 사진첩을 거쳐 왔으면
 * 캐시를 재사용한다. 목록 API가 최신순이므로 첫 항목이 최근 앨범이다.
 */
function AlbumPreview() {
  const { data, isLoading } = useQuery({
    queryKey: ["albums", "list"],
    queryFn: () => api.albums.list(),
  });

  const album = data?.items[0];
  if (isLoading || !album) return null;

  return (
    <Link
      href={`/photos/${album.id}`}
      className="flex gap-4 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 transition hover:bg-[var(--color-navy-100)]/40"
    >
      {album.coverThumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- presigned URL (위와 같은 이유)
        <img
          src={album.coverThumbUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-20 w-20 shrink-0 rounded-[4px] bg-[var(--color-navy-100)] object-cover"
        />
      ) : (
        <div
          aria-hidden
          className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[4px] bg-[var(--color-navy-100)] text-xs text-[var(--color-ink)]"
        >
          사진 없음
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm text-[var(--color-gray-400)]">최근 앨범</p>
        <p className="mt-1 truncate font-bold">{album.title}</p>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">{album.photoCount}장</p>
      </div>
    </Link>
  );
}

/**
 * `/my` 상단 미리보기 두 칸 (WIREFRAME.md §11 · FR-MEM-01).
 *
 * 원래 M3 계획이었지만 "주보·사진첩 데이터가 있어야 의미가 있어" 미뤄뒀던
 * 블록이다 (`my/page.tsx` 옛 주석). 이제 두 API가 다 있으므로 채운다.
 *
 * 각 칸은 데이터가 없으면 **스스로 렌더하지 않는다.** 주보가 아직 없는 주에
 * "주보 없음" 빈 카드를 띄우면 화면만 길어지고, 아래 타일 그리드로 어차피 갈
 * 수 있다. 로딩 중에도 자리를 잡지 않아 레이아웃이 한 번만 그려진다.
 */
export function MyPreviews() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BulletinPreview />
      <AlbumPreview />
    </div>
  );
}
