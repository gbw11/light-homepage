"use client";

import { memo, useMemo } from "react";
import type { QueueItem, QueueItemStatus } from "./queue";

/** 상태별 표시. 아이콘만으로 구분하지 않는다 — 색·모양은 보조 수단이다 */
const STATUS_LABEL: Record<QueueItemStatus, string> = {
  PREPARING: "준비 중",
  SKIPPED: "건너뜀",
  READY: "대기",
  UPLOADING: "올리는 중",
  DONE: "완료",
  FAILED: "실패",
};

const STATUS_CLASS: Record<QueueItemStatus, string> = {
  PREPARING: "text-[var(--color-gray-400)]",
  SKIPPED: "text-[var(--color-gray-400)]",
  READY: "text-[var(--color-gray-400)]",
  UPLOADING: "text-[var(--color-ink)] font-bold",
  DONE: "text-[var(--color-ink)] font-bold",
  FAILED: "text-[var(--color-red-500)] font-bold",
};

/**
 * 큐의 한 행. `memo`인 이유: 진행률 틱(150ms)마다 부모가 리렌더되는데,
 * `useUploadQueue.patch`는 **바뀐 항목의 객체만 교체**하고 나머지 항목의
 * 참조는 유지하므로, 행을 memo로 두면 243장 큐에서 실제로 다시 그리는 건
 * 지금 올라가는 몇 장뿐이다. (memo가 없으면 초당 ~1,300행 리렌더가 된다.)
 */
const QueueRow = memo(function QueueRow({
  item,
  running,
  onRetry,
}: {
  item: QueueItem;
  running: boolean;
  onRetry: (clientIds: string[]) => void;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1 truncate text-sm" title={item.fileName}>
        {item.fileName}
      </span>
      <span className={`shrink-0 text-sm ${STATUS_CLASS[item.status]}`}>
        {item.status === "UPLOADING" ? `${item.progress}%` : STATUS_LABEL[item.status]}
      </span>
      {item.status === "FAILED" && (
        <button
          type="button"
          disabled={running}
          // 같은 이름의 버튼이 여러 개 나열되므로 어떤 파일인지 이름에 넣는다
          aria-label={`${item.fileName} 다시 시도`}
          onClick={() => onRetry([item.clientId])}
          // 터치 타겟 44px (ARCHITECTURE §11) — 목록 안 버튼도 예외가 아니다
          className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-3 text-sm font-bold transition hover:brightness-95 disabled:opacity-50"
        >
          재시도
        </button>
      )}
    </li>
  );
});

/**
 * WIREFRAME.md §18 — 전체/완료/실패 카운트 + 진행률 + 항목별 상태.
 *
 * ⚠️ **항목별 상태를 반드시 보여준다.** 전체 진행률만 있으면 243장 중 2장이
 * 실패했을 때 어느 파일인지 알 수 없어 전체 재업로드밖에 방법이 없어진다
 * (FR-PHO-08).
 */
export function UploadQueueList({
  items,
  running,
  onRetry,
}: {
  items: readonly QueueItem[];
  running: boolean;
  /** 실패한 항목만 다시 태운다 — 전체 재업로드를 요구하지 않는다 (FR-PHO-08) */
  onRetry: (clientIds: string[]) => void;
}) {
  const total = items.length;
  // 상태별 filter를 여러 번 돌리지 않고 한 번에 센다 — 진행률 틱마다
  // 이 컴포넌트가 리렌더되므로 렌더당 순회는 한 번이면 된다.
  const { done, failed, skipped, failedIds, errorItems } = useMemo(() => {
    let done = 0;
    let failed = 0;
    let skipped = 0;
    const failedIds: string[] = [];
    const errorItems: QueueItem[] = [];
    for (const item of items) {
      if (item.status === "DONE") done += 1;
      else if (item.status === "FAILED") {
        failed += 1;
        failedIds.push(item.clientId);
      } else if (item.status === "SKIPPED") skipped += 1;
      if (item.error) errorItems.push(item);
    }
    return { done, failed, skipped, failedIds, errorItems };
  }, [items]);

  // 건너뛴 파일은 올릴 수 없으므로 분모에서 뺀다 — 그러지 않으면 진행률이
  // 100%에 닿지 못해 "끝났는데 안 끝난" 화면이 된다.
  const uploadable = total - skipped;
  const percent = uploadable === 0 ? 0 : Math.round((done / uploadable) * 100);

  return (
    <div className="mt-8">
      {/*
        진행 상황은 스크린리더에도 전달돼야 한다. 다만 `assertive`로 두면 장마다
        읽기를 끊어버리므로 `polite`로 둔다.
      */}
      <p aria-live="polite" className="text-sm font-bold">
        전체 {total}장 · 완료 {done} · 실패 {failed}
        {skipped > 0 && ` · 건너뜀 ${skipped}`}
      </p>

      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="업로드 진행률"
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-navy-100)]"
      >
        <div
          className="h-full bg-[var(--color-yellow)] transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">{percent}%</p>

      <ul className="mt-5 divide-y divide-[var(--color-navy-100)] rounded-[var(--radius-card)] border border-[var(--color-navy-100)]">
        {items.map((item) => (
          <QueueRow key={item.clientId} item={item} running={running} onRetry={onRetry} />
        ))}
      </ul>

      {/*
        243장 중 2장이 실패했을 때 한 번에 처리할 수단이 있어야 한다 — 행마다
        [재시도]를 누르게 만들면 실질적으로 전체 재업로드와 다를 게 없다.
      */}
      {failed > 1 && (
        <button
          type="button"
          disabled={running}
          onClick={() => onRetry(failedIds)}
          className="mt-3 inline-flex min-h-11 items-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-5 text-base font-bold transition hover:brightness-95 disabled:opacity-50"
        >
          실패 {failed}건 모두 재시도
        </button>
      )}

      {/* 건너뛴 파일은 이유를 알려줘야 사용자가 조치할 수 있다 (JPG로 재저장 등) */}
      {errorItems.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-[var(--color-red-500)]">
          {errorItems.map((item) => (
            <li key={`error-${item.clientId}`}>
              {item.fileName} — {item.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
