"use client";

import { useState } from "react";
import type { PendingPage } from "./pages";

/**
 * WIREFRAME.md §17 — 순서가 있는 주보 페이지 목록.
 *
 * ⚠️ **순서 변경 UI는 선택이 아니라 필수다** (FR-BUL-05: "앞/뒷면 순서가
 * 뒤바뀌면 읽을 수 없다").
 *
 * 와이어프레임은 드래그(`↕ 끌어서 순서 변경`)를 그렸지만, **드래그만으로는
 * 키보드·스크린리더 사용자가 순서를 바꿀 수 없다.** 그래서 [위로]/[아래로]
 * 버튼을 1차 수단으로 두고, 드래그는 그 위에 얹었다.
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
  /** 끌고 있는 항목의 인덱스 — 드래그 중이 아니면 null */
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  return (
    <>
      <ol className="mt-4 divide-y divide-[var(--color-navy-100)] rounded-[var(--radius-card)] border border-[var(--color-navy-100)]">
        {pages.map((page, index) => (
          <li
            key={page.id}
            /*
              드래그는 ↑↓ 버튼 위에 얹은 **보조 수단**이다 (마우스 사용자에게
              2~4장 순서 맞추기가 훨씬 빠르다). 키보드로는 여전히 버튼을 쓴다.
            */
            draggable
            onDragStart={(event) => {
              setDragIndex(index);
              // 데이터를 넣지 않으면 Firefox가 드래그를 시작하지 않는다
              event.dataTransfer.setData("text/plain", page.id);
              event.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(event) => {
              // preventDefault를 하지 않으면 drop 이벤트가 아예 오지 않는다
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null) onMove(dragIndex, index);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
            className={`flex items-center gap-3 p-3 ${
              dragIndex === index ? "opacity-40" : ""
            }`}
          >
            <span className="w-5 shrink-0 text-sm font-bold text-[var(--color-gray-400)]">
              {index + 1}
            </span>

            {/*
              드래그 손잡이 표시. 실제 드래그는 행 전체가 받으므로 이건 순수
              장식이다 — 스크린리더에는 읽히지 않게 한다 (↑↓ 버튼이 그 역할).
            */}
            <span aria-hidden className="shrink-0 cursor-move text-[var(--color-gray-400)]">
              ↕
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
        위 순서가 그대로 페이지 번호가 됩니다. ↑↓ 버튼이나 끌어서 바꿀 수 있습니다.
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
