"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { Photo } from "@/types/api";
import { AlbumDangerZone } from "./AlbumDangerZone";
import { Lightbox } from "./Lightbox";
import { UploadLink } from "./UploadLink";

/** SPEC_API §6.4 — 커서 페이징 기본 크기 (mock도 20장) */
const PAGE_SIZE = 20;

/**
 * 4xx는 재시도하지 않는다. 전역 `QueryClient`(QueryProvider)는 기본 재시도
 * 3회라, 없는 앨범(404)에 들어가면 에러 화면이 나오기까지 7초 넘게
 * "불러오는 중..."이 걸린다 — 없는 리소스를 다시 조회해도 결과는 같다.
 */
function retryOnlyServerErrors(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/**
 * 그리드의 타일 한 칸. `memo`인 이유: 부모가 리렌더돼도 사진 목록이 실제로
 * 바뀌지 않는 한 타일은 다시 그릴 것이 없다 — 무한 스크롤이라 장수에
 * 상한이 없어서 다음 페이지가 붙을 때마다 전부 다시 그리면 비싸진다.
 */
const PhotoTile = memo(function PhotoTile({
  photo,
  index,
  onOpen,
}: {
  photo: Photo;
  index: number;
  onOpen: (index: number) => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(index)}
        aria-label={`사진 ${index + 1} 확대 보기`}
        className="relative block aspect-square w-full overflow-hidden rounded-[4px] bg-[var(--color-navy-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 실서비스 URL은 R2 presigned(만료·서명 포함)라 next/image 최적화 대상이 아니다 (SPEC_API §6.4) */}
        <img
          src={photo.thumbUrl}
          alt=""
          width={photo.width}
          height={photo.height}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </button>
    </li>
  );
});

/**
 * WIREFRAME.md §13-2 — 앨범 상세 3열 썸네일 그리드 + 무한 스크롤.
 *
 * ⚠️ 그리드는 `thumbUrl`(640px, ~80KB)만 쓴다. `viewUrl`(1280px)을 여기에
 * 쓰면 200장 열람에 수백 MB가 나간다 (SPEC_API §6.4).
 *
 * 사진 비율이 섞여 있으므로(4:3 · 16:9 · 세로 1200x1600) 그리드 칸은
 * 정사각형으로 고정하고 `object-cover`로 중앙을 잘라 격자를 유지한다.
 * 원본 비율은 라이트박스에서 보여준다 (§13-4).
 */
export function PhotoGrid({ albumId }: { albumId: string }) {
  const photosQuery = useInfiniteQuery({
    queryKey: ["albums", albumId, "photos"],
    queryFn: ({ pageParam }) =>
      api.albums.photos(albumId, { cursor: pageParam ?? undefined, size: PAGE_SIZE }),
    initialPageParam: null as string | null,
    // nextCursor가 null이면 undefined를 돌려줘야 TanStack Query가 끝으로 판단한다
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.nextCursor : undefined),
    retry: retryOnlyServerErrors,
  });

  /**
   * 헤더의 앨범 제목·전체 장수는 목록 API에서 가져온다 — 사진 조회
   * (`§6.4`)는 앨범 메타를 돌려주지 않는다. 앨범 목록 화면과 동일한 쿼리 키를
   * 쓰므로 목록을 거쳐 들어온 경우 캐시를 재사용한다(추가 요청 없음).
   * 이 쿼리가 실패해도 그리드는 그대로 보여준다 (제목만 생략).
   */
  const albumQuery = useQuery({
    queryKey: ["albums", "list"],
    queryFn: () => api.albums.list(),
    retry: retryOnlyServerErrors,
  });
  const album = albumQuery.data?.items.find((a) => a.id === albumId);

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = photosQuery;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(() => {
    // 진행 중인 요청이 있으면 다시 쏘지 않는다 (중복 fetch 방지)
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      // 바닥에 닿기 전에 미리 다음 장을 받아둔다
      { rootMargin: "400px 0px" },
    );
    observer.observe(el);

    return () => observer.disconnect();
  }, [hasNextPage, loadMore]);

  /** 라이트박스로 열린 사진의 인덱스 — 닫혀 있으면 null (WIREFRAME §13-4) */
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  /**
   * 사진 삭제 결과 안내 (FR-PHO-09). 라이트박스가 닫히면서 사라지므로
   * 결과는 목록 화면이 들고 있어야 한다 — 안 그러면 삭제 후 아무 일도 없었던
   * 것처럼 보인다. mock의 no-op 안내도 이 문구에 실려 온다
   * (`PhotoDeletePanel` 상단 주석).
   */
  const [deleteNotice, setDeleteNotice] = useState<string | null>(null);

  // 렌더마다 flatMap으로 새 배열을 만들면 부모가 리렌더될 때마다 Lightbox까지
  // 새 props를 받는다 — 페이지 데이터가 실제로 바뀔 때만 다시 만든다.
  const photos: Photo[] = useMemo(
    () => photosQuery.data?.pages.flatMap((p) => p.items) ?? [],
    [photosQuery.data],
  );
  const notFound =
    photosQuery.isError && isApiError(photosQuery.error) && photosQuery.error.code === "NOT_FOUND";

  return (
    <>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <Link
          href="/photos"
          className="text-sm font-bold text-[var(--color-gray-400)] hover:underline"
        >
          ← 사진첩
        </Link>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">{album?.title ?? "앨범"}</h1>
            {!notFound && (
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                {album ? `${album.photoCount}장` : `${photos.length}장`}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!notFound && <UploadLink albumId={albumId} />}
          </div>
        </div>
      </section>

      {/*
        `role="status"`(암시적 aria-live) — 삭제 결과는 스크린리더에도 전달돼야
        한다. 되돌릴 수 없는 동작의 결과를 조용히 넘기지 않는다.
      */}
      {deleteNotice && (
        <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-6 md:px-10">
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4"
          >
            <p className="text-sm leading-relaxed">{deleteNotice}</p>
            <button
              type="button"
              onClick={() => setDeleteNotice(null)}
              aria-label="삭제 결과 안내 닫기"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl hover:bg-[var(--color-navy-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
            >
              ✕
            </button>
          </div>
        </section>
      )}

      <Section className="pt-8">
        {photosQuery.isLoading ? (
          <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
        ) : notFound ? (
          <p className="text-[var(--color-red-500)]">앨범을 찾을 수 없습니다.</p>
        ) : photosQuery.isError ? (
          <p className="text-[var(--color-red-500)]">
            {isApiError(photosQuery.error)
              ? photosQuery.error.message
              : "사진을 불러오지 못했습니다."}
          </p>
        ) : photos.length === 0 ? (
          <p className="text-[var(--color-gray-400)]">아직 등록된 사진이 없습니다.</p>
        ) : (
          <>
            {/*
              모바일 3열이 기준이다 (WIREFRAME §13-2). 데스크톱에서 3열을 유지하면
              썸네일 한 칸이 370px가 넘어 640px 썸네일이 흐릿하게 늘어나고 한 화면에
              6장밖에 안 들어간다 — 폭이 넓어지면 열을 늘린다 (COMPONENTS §5 반응형).
            */}
            <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-5 md:gap-2 lg:grid-cols-6">
              {photos.map((photo, i) => (
                <PhotoTile key={photo.id} photo={photo} index={i} onOpen={setOpenIndex} />
              ))}
            </ul>

            {/* 무한 스크롤 감지용 sentinel — 화면에 들어오면 다음 커서를 받는다 */}
            <div ref={sentinelRef} aria-hidden className="h-1" />

            {isFetchingNextPage && (
              <p className="pt-6 text-center text-sm text-[var(--color-gray-400)]">
                더 불러오는 중...
              </p>
            )}
            {!hasNextPage && (
              <p className="pt-6 text-center text-sm text-[var(--color-gray-400)]">
                사진 {photos.length}장을 모두 불러왔습니다.
              </p>
            )}
          </>
        )}
      </Section>

      {/*
        FR-PHO-09 — 앨범 삭제는 그리드 **아래**에 둔다 (컴포넌트 주석 참고).
        제목을 모르면(목록 조회 실패) 타이핑 확인을 할 수 없으므로 렌더하지 않는다.
        AlbumDangerZone이 임원 여부를 스스로 판단해 렌더한다.
      */}
      {!notFound && album && (
        <AlbumDangerZone
          albumId={albumId}
          title={album.title}
          photoCount={album.photoCount}
        />
      )}

      {openIndex !== null && (
        <Lightbox
          albumId={albumId}
          photos={photos}
          totalCount={album?.photoCount}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onReachEnd={loadMore}
          onPhotoDeleted={setDeleteNotice}
        />
      )}
    </>
  );
}
