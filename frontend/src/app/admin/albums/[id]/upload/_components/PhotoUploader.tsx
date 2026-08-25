"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { UploadQueueList } from "./UploadQueueList";
import { useUploadQueue } from "./useUploadQueue";

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

  const { items, running, blocked, addFiles, start } = useUploadQueue(albumId);
  // 인라인 화살표로 넘기면 렌더마다 새 함수라 QueueRow의 memo가 전부 빗나간다
  const handleRetry = useCallback((clientIds: string[]) => void start(clientIds), [start]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  // 아직 한 번도 올리지 않은 장수. 실패분은 세지 않는다 — 그건 [재시도]가 맡고,
  // 두 버튼이 같은 수를 말하면 어느 쪽을 눌러야 하는지 알 수 없다.
  const ready = items.filter((item) => item.status === "READY").length;
  const preparing = items.some((item) => item.status === "PREPARING");

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    void addFiles(Array.from(fileList));
  }

  return (
    <Section>
      <Link
        href={`/photos/${albumId}`}
        className="inline-flex min-h-11 items-center text-sm font-bold text-[var(--color-gray-400)] hover:underline"
      >
        ← 앨범으로 돌아가기
      </Link>

      <h1 className="mt-2 text-xl font-bold md:text-2xl">사진 업로드</h1>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        앨범: {album ? album.title : "…"}
      </p>

      {/*
        드래그&드롭 영역. 드롭만 지원하면 키보드 사용자가 아무것도 할 수 없으므로
        `<label>`로 감싼 실제 `<input type=file>`을 함께 둔다 — label을 통하면
        Tab·Enter로도 파일 선택 창이 열린다.
      */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={`mt-8 rounded-[var(--radius-card)] border-2 border-dashed p-10 text-center transition ${
          dragging
            ? "border-[var(--color-yellow)] bg-[var(--color-navy-100)]/40"
            : "border-[var(--color-navy-100)]"
        }`}
      >
        <p className="text-base font-bold">사진을 끌어다 놓거나</p>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          여러 장 한 번에 올릴 수 있습니다
        </p>

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          /*
            탭 순서에서는 뺀다 — 바로 아래 [파일 선택] 버튼이 이 input을
            클릭하므로, 그냥 두면 키보드 사용자가 보이지 않는 정지점을 한 번
            더 지나게 된다. 버튼은 실제 `<button>`이라 Enter/Space로 동작한다.
          */
          tabIndex={-1}
          onChange={(event) => {
            handleFiles(event.target.files);
            // 같은 파일을 다시 고를 수 있어야 한다 — value를 비우지 않으면
            // 같은 경로를 재선택했을 때 change가 발생하지 않는다.
            event.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="mt-5"
          onClick={() => inputRef.current?.click()}
        >
          파일 선택
        </Button>
      </div>

      {items.length > 0 && (
        <>
          <UploadQueueList items={items} running={running} onRetry={handleRetry} />

          {/*
            큐 전체가 멈춘 이유는 항목별 실패와 따로 보여준다 — 용량 초과라면
            사용자가 할 일이 "재시도"가 아니라 "용량 정리"이기 때문이다
            (FR-PHO-10 "조용히 과금되는 것보다 업로드를 막는 것이 낫다").
          */}
          {blocked && (
            <div
              role="alert"
              className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-red-500)] p-4 text-sm text-[var(--color-red-500)]"
            >
              <p className="font-bold">업로드를 중단했습니다</p>
              <p className="mt-1">{blocked.message}</p>
              {blocked.code === "STORAGE_LIMIT" && (
                <p className="mt-2">
                  저장 용량이 한도에 가까워 더 올릴 수 없습니다. 다시 시도해도 같은
                  결과이므로,{" "}
                  <Link href="/admin" className="underline">
                    관리 화면
                  </Link>
                  에서 사용량을 확인하고 오래된 앨범을 정리해 주세요.
                </p>
              )}
            </div>
          )}

          {(ready > 0 || preparing || running) && (
            <div className="mt-5">
              <Button
                type="button"
                disabled={running || preparing || ready === 0}
                onClick={() => void start()}
              >
                {running ? "올리는 중..." : preparing ? "준비 중..." : `${ready}장 업로드`}
              </Button>
            </div>
          )}
        </>
      )}

      {/*
        FR-PHO-04 — 보관 화질 경계를 업로드 시점에 알린다. 올린 뒤에 "원본이
        없다"는 걸 알게 되면 되돌릴 방법이 없다 (촬영 원본은 보관하지 않는다).
      */}
      <ul className="mt-6 space-y-1 text-sm text-[var(--color-gray-400)]">
        <li>
          · 사진은 브라우저에서 장변 2560px으로 줄여 올립니다. 촬영 원본은 보관되지
          않습니다.
        </li>
        <li>· 업로드가 끝날 때까지 창을 닫지 마세요.</li>
      </ul>
    </Section>
  );
}
