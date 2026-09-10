"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { ErrorCode } from "@/types/api";
import { ResizeError, resizeForUpload, type ResizedPhoto } from "@/lib/image/resize";
import {
  BATCH_SIZE,
  CONCURRENCY,
  chunk,
  nextClientId,
  runWithConcurrency,
  type QueueItem,
} from "./queue";

/**
 * 진행률 렌더 간격(ms).
 *
 * XHR `progress`는 파일 하나당 수십 번 뜬다. 200장이면 수천 번이고, 그때마다
 * 200행 목록을 다시 그리면 업로드보다 렌더가 병목이 된다. 상태 **변화**는 즉시
 * 반영하고, 진행률만 이 간격으로 모아 흘린다.
 */
const PROGRESS_FLUSH_MS = 150;

/**
 * 전체 진행률에서 view(1280px)가 차지하는 비중.
 *
 * view는 thumb보다 10배 이상 크다. 둘을 50:50으로 세면 진행률이 절반에서
 * 오래 멈춘 것처럼 보인다.
 */
const VIEW_WEIGHT = 0.9;

/**
 * 업로드 큐 (WIREFRAME §18 · FR-PHO-08).
 *
 * 흐름은 세 단계다 (ARCHITECTURE.md §7.3):
 *   ① 브라우저 리사이즈 (1280/640 WebP)
 *   ② `uploads:issue` → **R2로 직접 PUT** (동시 4개, 20장 배치)
 *   ③ `uploads:commit` (20장 배치) → `COMMITTED`
 *
 * ⚠️ **리사이즈 결과(blob)는 React 상태에 넣지 않는다.** 200장 × 2 blob을
 * 상태에 담으면 렌더마다 거대한 배열을 복사하게 되고, 진행률 갱신 하나에
 * 수백 MB가 얽힌다. blob은 ref에, 화면에 보여줄 것만 상태에 둔다.
 */
export function useUploadQueue(albumId: string) {
  /** 표시용 상태의 **원본**. 비동기 루프가 최신 값을 읽어야 해서 ref가 진실이다 */
  const itemsRef = useRef<QueueItem[]>([]);
  const [items, setItems] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  /**
   * 큐 전체를 멈춘 이유 (용량 초과·권한 등). 항목별 실패와 구분한다.
   *
   * `code`를 함께 들고 있는 이유: `STORAGE_LIMIT`은 사용자가 할 일이
   * "재시도"가 아니라 "용량 정리"라서 화면이 다르게 안내해야 한다 (FR-PHO-10).
   */
  const [blocked, setBlocked] = useState<{ code: ErrorCode | null; message: string } | null>(
    null,
  );

  const resizedRef = useRef(new Map<string, ResizedPhoto>());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryClient = useQueryClient();

  const flushNow = useCallback(() => {
    if (flushTimerRef.current !== null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setItems([...itemsRef.current]);
  }, []);

  const flushSoon = useCallback(() => {
    if (flushTimerRef.current !== null) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      setItems([...itemsRef.current]);
    }, PROGRESS_FLUSH_MS);
  }, []);

  /** ref를 고치고 화면에 반영한다. `immediate=false`는 진행률용(모아서 흘린다) */
  const patch = useCallback(
    (clientId: string, next: Partial<QueueItem>, immediate = true) => {
      const index = itemsRef.current.findIndex((item) => item.clientId === clientId);
      if (index < 0) return;
      itemsRef.current[index] = { ...itemsRef.current[index], ...next };
      if (immediate) flushNow();
      else flushSoon();
    },
    [flushNow, flushSoon],
  );

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;

      // clientId를 먼저 확정한다 — 리사이즈가 끝나는 순서는 제각각이고,
      // 인덱스로 상태를 찾으면 그 사이에 추가된 파일과 섞인다.
      const entries = files.map((file) => ({ clientId: nextClientId(), file }));

      itemsRef.current = [
        ...itemsRef.current,
        ...entries.map(({ clientId, file }) => ({
          clientId,
          fileName: file.name,
          status: "PREPARING" as const,
          progress: 0,
        })),
      ];
      flushNow();

      await runWithConcurrency(entries, CONCURRENCY, async ({ clientId, file }) => {
        try {
          const resized = await resizeForUpload(file);
          resizedRef.current.set(clientId, resized);
          patch(clientId, { status: "READY" });
        } catch (error) {
          // 리사이즈 실패는 **건너뛴다** — 같은 파일을 다시 시도해도 결과가
          // 같으므로 재시도 대상(FAILED)에 넣지 않는다 (WORKPLAN §8.2).
          patch(clientId, {
            status: "SKIPPED",
            error:
              error instanceof ResizeError ? error.message : "이 파일을 읽지 못했습니다.",
          });
        }
      });
    },
    [flushNow, patch],
  );

  /**
   * 대기·실패 항목을 올린다.
   *
   * 실패 항목을 함께 태우는 이유: 재시도가 곧 "같은 파일을 다시 이 흐름에 태우는
   * 것"이기 때문이다. photoId를 그대로 들고 있으므로 `issue`가 같은 행을 다시
   * 쓰고 R2에 고아가 남지 않는다 (SPEC_API §6.5).
   */
  const start = useCallback(
    async (onlyClientIds?: readonly string[]) => {
    if (running) return;

    const only = onlyClientIds ? new Set(onlyClientIds) : null;
    const targets = itemsRef.current.filter(
      (item) =>
        (item.status === "READY" || item.status === "FAILED") &&
        (!only || only.has(item.clientId)),
    );
    if (targets.length === 0) return;

    setRunning(true);
    setBlocked(null);

    // 재시도분의 이전 에러 문구를 지운다 — 남겨두면 성공한 뒤에도 빨간 줄이 남는다
    for (const item of targets) {
      patch(item.clientId, { status: "READY", progress: 0, error: undefined });
    }

    try {
      for (const batch of chunk(targets, BATCH_SIZE)) {
        const files = batch
          .map((item) => {
            const resized = resizedRef.current.get(item.clientId);
            if (!resized) return null;
            return {
              clientId: item.clientId,
              sizeBytes: resized.view.size,
              thumbSizeBytes: resized.thumb.size,
              width: resized.width,
              height: resized.height,
              takenAt: resized.takenAt,
            };
          })
          .filter((file): file is NonNullable<typeof file> => file !== null);

        if (files.length === 0) continue;

        let tickets;
        try {
          const issued = await api.uploads.issue({ albumId, files });
          tickets = new Map(issued.uploads.map((ticket) => [ticket.clientId, ticket]));
        } catch (error) {
          /*
            issue 실패는 **배치 전체**의 실패다. 용량 초과(STORAGE_LIMIT)라면
            다음 배치도 똑같이 막히므로 큐를 세운다 — 200장에 대해 같은 409를
            10번 받아낼 이유가 없다 (FR-PHO-10 "조용히 과금되는 것보다 막는다").
          */
          const message = isApiError(error)
            ? error.message
            : "업로드 URL을 발급받지 못했습니다.";
          for (const item of batch) {
            patch(item.clientId, { status: "FAILED", error: message });
          }
          setBlocked({ code: isApiError(error) ? error.code : null, message });
          return;
        }

        /** 전송까지 끝나 commit 대상이 된 photoId */
        const uploaded: string[] = [];

        await runWithConcurrency(batch, CONCURRENCY, async (item) => {
          const ticket = tickets.get(item.clientId);
          const resized = resizedRef.current.get(item.clientId);
          if (!ticket || !resized) {
            patch(item.clientId, {
              status: "FAILED",
              error: "업로드 URL을 받지 못했습니다.",
            });
            return;
          }

          patch(item.clientId, {
            status: "UPLOADING",
            progress: 0,
            photoId: ticket.photoId,
          });

          try {
            await api.uploads.put(ticket.viewPutUrl, resized.view, {
              onProgress: (percent) =>
                patch(item.clientId, { progress: Math.round(percent * VIEW_WEIGHT) }, false),
            });
            await api.uploads.put(ticket.thumbPutUrl, resized.thumb, {
              onProgress: (percent) =>
                patch(
                  item.clientId,
                  { progress: Math.round(VIEW_WEIGHT * 100 + percent * (1 - VIEW_WEIGHT)) },
                  false,
                ),
            });
            // commit 전까지는 아직 완료가 아니다 (서버가 COMMITTED로 바꿔야 한다)
            patch(item.clientId, { progress: 100 });
            uploaded.push(ticket.photoId);
          } catch (error) {
            patch(item.clientId, {
              status: "FAILED",
              error: error instanceof Error ? error.message : "전송에 실패했습니다.",
            });
          }
        });

        if (uploaded.length === 0) continue;

        try {
          const result = await api.uploads.commit(uploaded);
          const failedById = new Map(result.failed.map((f) => [f.photoId, f.reason]));

          for (const item of batch) {
            const photoId = itemsRef.current.find(
              (current) => current.clientId === item.clientId,
            )?.photoId;
            if (!photoId || !uploaded.includes(photoId)) continue;

            const reason = failedById.get(photoId);
            if (reason) {
              patch(item.clientId, {
                status: "FAILED",
                error: `서버가 확정하지 못했습니다 (${reason}).`,
              });
            } else {
              patch(item.clientId, { status: "DONE", progress: 100 });
              // blob은 더 필요하지 않다 — 200장 분량을 계속 붙잡고 있지 않는다
              resizedRef.current.delete(item.clientId);
            }
          }
        } catch (error) {
          // 전송은 됐지만 확정을 못 한 상태다. 미커밋 `PENDING`은 서버가 24시간
          // 후 정리하므로(§6.6) 재시도해도 쓰레기가 쌓이지 않는다.
          const message = isApiError(error)
            ? error.message
            : "업로드를 확정하지 못했습니다.";
          for (const item of batch) {
            // 전송조차 못 한 항목은 이미 자기 에러를 갖고 있다 — 덮어쓰지 않는다
            const photoId = itemsRef.current.find(
              (current) => current.clientId === item.clientId,
            )?.photoId;
            if (photoId && uploaded.includes(photoId)) {
              patch(item.clientId, { status: "FAILED", error: message });
            }
          }
        }
      }
    } finally {
      flushNow();
      setRunning(false);
      // 앨범 목록·사진 그리드를 다시 읽게 한다 (장수·커버가 바뀌었다)
      void queryClient.invalidateQueries({ queryKey: ["albums"] });
    }
    },
    [albumId, flushNow, patch, queryClient, running],
  );

  /**
   * 업로드 중 페이지 이탈 경고 (FR-PHO-08 · WIREFRAME §18 "창을 닫지 마세요").
   *
   * 탭을 닫으면 진행 중인 PUT이 끊기고, 확정되지 않은 사진은 서버가 24시간 후
   * 정리한다 — 사용자 입장에서는 "올린 줄 알았는데 없는" 상태가 된다.
   *
   * ⚠️ 문구는 브라우저가 무시한다 (자체 문구를 쓴다). 그래도 `preventDefault`가
   * 확인 창을 띄우는 유일한 방법이다.
   */
  useEffect(() => {
    if (!running) return;

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  /** 타이머가 남은 채로 언마운트되면 사라진 컴포넌트에 setState하게 된다 */
  useEffect(
    () => () => {
      if (flushTimerRef.current !== null) clearTimeout(flushTimerRef.current);
    },
    [],
  );

  return { items, running, blocked, addFiles, start };
}
