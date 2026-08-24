"use client";

import { useCallback, useState } from "react";
import { ResizeError, resizeForUpload } from "@/lib/image/resize";
import { nextClientId, runWithConcurrency, type QueueItem } from "./queue";

/**
 * 리사이즈 동시 실행 수. 전송(3~4)과 같은 값을 쓴다 — 리사이즈는 CPU 작업이라
 * 더 늘려도 코어 수를 넘지 못하고, 메모리에 뜬 비트맵만 늘어난다.
 */
const RESIZE_CONCURRENCY = 4;

/**
 * 업로드 큐 상태 (WIREFRAME §18).
 *
 * 이 훅이 파일을 받아 **브라우저 리사이즈까지** 책임진다. 전송은 다음 단위에서
 * 붙는다 — 리사이즈 결과를 눈으로 확인하고 나서 R2 전송을 얹기 위해서다
 * (`frontend/docs/WORKFLOW.md` §1 분해 기준).
 */
export function useUploadQueue() {
  const [items, setItems] = useState<QueueItem[]>([]);

  const patch = useCallback((clientId: string, next: Partial<QueueItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, ...next } : item)),
    );
  }, []);

  const addFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) return;

      // clientId를 먼저 확정한다 — 리사이즈가 끝나는 순서는 제각각이고,
      // 인덱스로 상태를 찾으면 그 사이에 추가된 파일과 섞인다.
      const entries = files.map((file) => ({ clientId: nextClientId(), file }));

      setItems((prev) => [
        ...prev,
        ...entries.map(({ clientId, file }) => ({
          clientId,
          fileName: file.name,
          status: "PREPARING" as const,
          progress: 0,
        })),
      ]);

      await runWithConcurrency(entries, RESIZE_CONCURRENCY, async ({ clientId, file }) => {
        try {
          const resized = await resizeForUpload(file);
          patch(clientId, { status: "READY", resized });
        } catch (error) {
          // 리사이즈 실패는 **건너뛴다** — 같은 파일을 다시 시도해도 결과가
          // 같으므로 재시도 대상(FAILED)에 넣지 않는다 (WORKPLAN §8.2).
          patch(clientId, {
            status: "SKIPPED",
            error:
              error instanceof ResizeError
                ? error.message
                : "이 파일을 읽지 못했습니다.",
          });
        }
      });
    },
    [patch],
  );

  const clear = useCallback(() => setItems([]), []);

  return { items, addFiles, clear };
}
