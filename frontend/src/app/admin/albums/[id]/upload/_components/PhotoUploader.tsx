"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";

/**
 * 4xx는 재시도하지 않는다 (`PhotoGrid`와 같은 이유 — 없는 앨범을 다시 조회해도
 * 결과가 같고, 전역 기본 재시도 3회가 에러 표시를 7초 넘게 늦춘다).
 */
function retryOnlyServerErrors(failureCount: number, error: unknown): boolean {
  if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

/**
 * WIREFRAME.md §18 — 사진 업로드 화면.
 *
 * 앨범 제목은 목록 API에서 읽는다 (`§6.4`는 앨범 메타를 주지 않는다).
 * 앨범 상세를 거쳐 들어오면 같은 쿼리 키(`["albums", "list"]`)의 캐시를
 * 재사용하므로 추가 요청이 없다. 실패해도 업로드 자체는 막지 않는다 —
 * 제목만 생략한다.
 */
export function PhotoUploader({ albumId }: { albumId: string }) {
  const albumQuery = useQuery({
    queryKey: ["albums", "list"],
    queryFn: () => api.albums.list(),
    retry: retryOnlyServerErrors,
  });
  const album = albumQuery.data?.items.find((a) => a.id === albumId);

  return (
    <Section>
      <Link
        href={`/my/photos/${albumId}`}
        className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-gray-400)] hover:underline"
      >
        ← 앨범으로 돌아가기
      </Link>

      <h1 className="mt-2 text-xl font-bold md:text-2xl">사진 업로드</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        앨범: {album ? album.title : "…"}
      </p>

      <div className="mt-8 rounded-[var(--radius-card)] border-2 border-dashed border-[var(--color-navy-100)] p-10 text-center">
        <p className="text-base font-bold">사진을 끌어다 놓거나</p>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          여러 장 한 번에 올릴 수 있습니다
        </p>
      </div>

      {/*
        FR-PHO-04 — 보관 화질 경계를 업로드 시점에 알린다. 올린 뒤에 "원본이
        없다"는 걸 알게 되면 되돌릴 방법이 없다 (촬영 원본은 보관하지 않는다).
      */}
      <ul className="mt-6 space-y-1 text-sm text-[var(--color-gray-400)]">
        <li>· 사진은 브라우저에서 장변 2560px으로 줄여 올립니다. 촬영 원본은 보관되지 않습니다.</li>
        <li>· 업로드가 끝날 때까지 창을 닫지 마세요.</li>
      </ul>
    </Section>
  );
}
