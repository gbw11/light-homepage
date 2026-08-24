"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { Photo } from "@/types/api";
import { AlbumDangerZone } from "./AlbumDangerZone";
import { Lightbox } from "./Lightbox";
import { MAX_ZIP_PHOTOS, SelectionBar } from "./SelectionBar";
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
 * WIREFRAME.md §13-2 — 앨범 상세 3열 썸네일 그리드 + 무한 스크롤.
 *
 * ⚠️ 그리드는 `thumbUrl`(640px, ~80KB)만 쓴다. `viewUrl`(2560px)을 여기에
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

  /**
   * 선택 모드 (WIREFRAME §13-3, FR-PHO-05).
   *
   * 선택은 **사진 id**로 들고 있다 — 인덱스로 들고 있으면 무한 스크롤로
   * 다음 페이지가 붙을 때 의미가 흔들린다. id 기준이면 20장을 더 불러와도
   * 이미 선택한 사진이 그대로 유지된다.
   */
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  /**
   * 하단 바 안내 문구 — 30장 제한, mock ZIP 미지원 안내가 같은 자리를 쓴다.
   * 두 곳에서 따로 관리하면 어느 문구가 최신인지 알 수 없어 한 곳에 모았다.
   */
  const [notice, setNotice] = useState<string | null>(null);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    // 선택 모드를 나가면 선택은 비운다 — 남겨두면 다시 들어왔을 때
    // 사용자가 기억하지 못하는 선택으로 ZIP을 만들게 된다.
    setSelectedIds([]);
    setNotice(null);
  }, []);

  const toggleSelected = useCallback((photoId: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(photoId)) {
        setNotice(null);
        return prev.filter((id) => id !== photoId);
      }
      if (prev.length >= MAX_ZIP_PHOTOS) {
        // 서버(§6.8)도 막지만 요청을 보내기 전에 화면에서 끊는다
        setNotice(`한 번에 최대 ${MAX_ZIP_PHOTOS}장까지 선택할 수 있습니다.`);
        return prev;
      }
      setNotice(null);
      return [...prev, photoId];
    });
  }, []);

  const photos: Photo[] = photosQuery.data?.pages.flatMap((p) => p.items) ?? [];
  const notFound =
    photosQuery.isError && isApiError(photosQuery.error) && photosQuery.error.code === "NOT_FOUND";

  return (
    <>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <Link
          href="/my/photos"
          className="text-sm font-bold text-[var(--color-gray-400)] hover:underline"
        >
          ← 사진첩
        </Link>
        {/*
          선택 모드에서는 제목 자리에 선택 장수를 띄우고 `[취소]`를 붙인다
          (WIREFRAME §13-3). 제목을 계속 보여주면 지금이 선택 모드인지가
          하단 바에만 드러난다 — 스크롤 위쪽에서도 알 수 있어야 한다.
        */}
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">
              {selectMode ? `${selectedIds.length}장 선택` : (album?.title ?? "앨범")}
            </h1>
            {!notFound && !selectMode && (
              <p className="mt-1 text-sm text-[var(--color-gray-400)]">
                {album ? `${album.photoCount}장` : `${photos.length}장`}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/*
              선택 모드에서는 감춘다 — 선택 중에 다른 화면으로 나가는 링크를 두면
              고른 사진이 조용히 사라진다.
            */}
            {!notFound && !selectMode && <UploadLink albumId={albumId} />}

            {!notFound && photos.length > 0 && (
              <button
                type="button"
                onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
                aria-pressed={selectMode}
                className="rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 py-2 text-sm font-bold hover:bg-[var(--color-navy-100)]"
              >
                {selectMode ? "취소" : "선택"}
              </button>
            )}
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
              {photos.map((photo, i) => {
                const selected = selectedIds.includes(photo.id);

                return (
                  <li key={photo.id}>
                    <button
                      type="button"
                      // 선택 모드에서 탭하면 선택이지 확대 보기가 아니다 (§13-3)
                      onClick={() => (selectMode ? toggleSelected(photo.id) : setOpenIndex(i))}
                      aria-label={
                        selectMode ? `사진 ${i + 1} 선택` : `사진 ${i + 1} 확대 보기`
                      }
                      aria-pressed={selectMode ? selected : undefined}
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
                        className={`h-full w-full object-cover ${selected ? "opacity-60" : ""}`}
                      />

                      {selectMode && (
                        <span
                          aria-hidden
                          className={`absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                            selected
                              ? "bg-[var(--color-yellow)] text-[var(--color-navy-900)]"
                              : "bg-black/40 text-white/80"
                          }`}
                        >
                          {selected ? "✓" : ""}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
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
        · 선택 모드에서는 감춘다: 지금은 "다운로드할 사진을 고르는 중"이고,
          하단 고정 바 근처에 파괴적 버튼을 같이 띄우면 오탭 위험만 만든다.
        · 제목을 모르면(목록 조회 실패) 타이핑 확인을 할 수 없으므로 렌더하지 않는다.
      */}
      {!notFound && !selectMode && album && (
        <AlbumDangerZone
          albumId={albumId}
          title={album.title}
          photoCount={album.photoCount}
        />
      )}

      {/*
        하단 고정 바가 마지막 줄을 덮지 않도록 여백을 준다. 안내 문구가
        두세 줄로 늘어날 수 있어(제한·mock 안내) 바 최대 높이 기준으로 잡는다.
      */}
      {selectMode && <div aria-hidden className="h-40" />}

      {selectMode && (
        <SelectionBar
          albumId={albumId}
          selectedIds={selectedIds}
          notice={notice}
          onNotice={setNotice}
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
