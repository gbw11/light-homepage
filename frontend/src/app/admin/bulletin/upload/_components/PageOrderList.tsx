"use client";

import type { PendingPage } from "./pages";

/**
 * WIREFRAME.md §17 — 순서가 있는 주보 페이지 목록.
 *
 * ⚠️ **순서 변경 UI는 선택이 아니라 필수다** (FR-BUL-05: "앞/뒷면 순서가
 * 뒤바뀌면 읽을 수 없다").
 *
 * 와이어프레임은 드래그(`↕ 끌어서 순서 변경`)를 그렸지만, **드래그만으로는
 * 키보드·스크린리더 사용자가 순서를 바꿀 수 없다.** 그래서 [위로]/[아래로]
 * 버튼을 1차 수단으로 두고, 드래그는 그 위에 얹는다 (다음 단위).
 */
export function PageOrderList({
  pages,
  onMove,
  onRemove,
}: {
  pages: readonly PendingPage[];
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <ol className="mt-4 divide-y divide-[var(--color-navy-100)] rounded-[var(--radius-card)] border border-[var(--color-navy-100)]">
        {pages.map((page, index) => (
          <li key={page.id} className="flex items-center gap-3 p-3">
            <span className="w-5 shrink-0 text-sm font-bold text-[var(--color-gray-400)]">
              {index + 1}
            </span>

            {/*
              next/image를 쓰지 않는다 — objectURL은 최적화 대상이 아니고
              (로컬 blob이다) loader를 통과시키면 오히려 실패한다.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={page.previewUrl}
              alt=""
              className="h-14 w-11 shrink-0 rounded border border-[var(--color-navy-100)] object-cover"
            />

            <span className="min-w-0 flex-1 truncate text-sm" title={page.file.name}>
              {page.file.name}
            </span>

            <div className="flex shrink-0 items-center gap-1">
              <OrderButton
                label={`${index + 1}번째 장을 위로`}
                disabled={index === 0}
                onClick={() => onMove(index, index - 1)}
              >
                ↑
              </OrderButton>
              <OrderButton
                label={`${index + 1}번째 장을 아래로`}
                disabled={index === pages.length - 1}
                onClick={() => onMove(index, index + 1)}
              >
                ↓
              </OrderButton>
              <OrderButton label={`${index + 1}번째 장 제거`} onClick={() => onRemove(page.id)}>
                ✕
              </OrderButton>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        위 순서가 그대로 페이지 번호가 됩니다. ↑↓ 버튼으로 바꿀 수 있습니다.
      </p>
    </>
  );
}

/** 목록 안 버튼도 터치 타겟 44px을 지킨다 (ARCHITECTURE §11) */
function OrderButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // 기호 하나뿐이라 스크린리더가 "↑"만 읽는다 — 몇 번째 장인지 이름에 넣는다
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold transition hover:bg-[var(--color-navy-100)] disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
    >
      {children}
    </button>
  );
}
