"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Bulletin } from "@/types/api";

/**
 * 스와이프로 인정할 최소 가로 이동량(px).
 * 라이트박스(`/my/photos/[id]/_components/Lightbox.tsx`)와 같은 값을 쓴다 —
 * 같은 제스처가 화면마다 다르게 느껴지지 않게 한다.
 */
const SWIPE_THRESHOLD = 50;

/** 입력 중인 곳에서는 화살표 키를 가로채지 않는다 */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** `2026-08-24` → `2026-08-24 주보` (WIREFRAME §12 표기) */
function bulletinLabel(serviceDate: string): string {
  return `${serviceDate} 주보`;
}

/**
 * WIREFRAME.md §12 — 주보 뷰어. 여러 장이면 `‹ 1 / 2 ›`로 장을 넘긴다.
 * 좌우 스와이프 · ←/→ 키로도 넘어간다 (FR-BUL-03).
 *
 * ⚠️ **로딩 전략이 사진첩과 반대다.** 주보는 글자가 작아 썸네일로는 읽을 수
 * 없으므로(FR-BUL-03 · SPEC_API §5.1) `pages[].url`(장변 2048px)을 처음부터
 * 그대로 로드한다. `thumbUrl`은 지난 주보 목록 행에서만 쓴다.
 *
 * 제스처·키보드 규칙은 라이트박스에서 그대로 가져왔다 (같은 동작이 화면마다
 * 다르면 안 된다): 임계값 50px, 세로로 더 많이 움직였으면 스와이프가 아니고,
 * 손가락이 2개 이상이면 판정을 포기한다.
 *
 * 라이트박스와 다른 점 두 가지:
 * · 모달이 아니라 페이지 안에 놓인 뷰어이므로 포커스 트랩·배경 스크롤
 *   잠금·Escape 닫기가 없다.
 * · ←/→ 는 window에서 듣되 입력 요소에 포커스가 있으면 무시한다. 이 페이지의
 *   주 내용이 뷰어 하나뿐이라, 뷰어에 포커스를 맞춰야만 동작하는 편보다
 *   바로 넘어가는 편이 실제 사용(주일 아침에 폰으로 열기)에 맞다.
 *
 * ⚠️ 핀치 줌: 라이트박스와 같은 판단으로 **커스텀 제스처를 구현하지 않았다.**
 * 뷰포트에 `user-scalable=no`가 없어 브라우저 기본 핀치 줌이 그대로 동작한다 —
 * 반쪽짜리 제스처 핸들러가 기본 동작까지 망치는 쪽이 더 나쁘다.
 * WIREFRAME §12의 "핀치 줌"은 이 기본 동작으로 충족한다.
 */
export function BulletinViewer({ bulletin }: { bulletin: Bulletin }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const pages = bulletin.pages;
  const total = pages.length;
  const page = pages[index] ?? pages[0];

  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total]);

  useEffect(() => {
    if (total <= 1) return;

    function onKeyDown(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [total, goPrev, goNext]);

  if (!page) return null;

  return (
    <div>
      <div
        className="relative flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-[var(--color-navy-100)]/30"
        onTouchStart={(e) => {
          // 손가락 2개 이상 = 핀치 → 브라우저 기본 동작에 맡기고 스와이프 판정을 포기한다
          if (e.touches.length !== 1) {
            touchStart.current = null;
            return;
          }
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || e.touches.length > 0) return;

          const end = e.changedTouches[0];
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          // 세로로 더 많이 움직였으면 스와이프가 아니다 (스크롤·핀치 오판 방지)
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
          if (dx > 0) goPrev();
          else goNext();
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- 실서비스 URL은 R2 presigned(만료·서명 포함)라 next/image 최적화 대상이 아니다 (SPEC_API §5.1) */}
        <img
          key={page.url}
          src={page.url}
          alt={`${bulletinLabel(bulletin.serviceDate)} ${page.pageNo}장`}
          width={page.width}
          height={page.height}
          // 큰 이미지를 바로 보여주는 화면이므로 지연 로딩하지 않는다 (FR-BUL-03)
          loading="eager"
          fetchPriority="high"
          className="max-h-[80vh] w-auto max-w-full object-contain"
        />

        {/* 1장짜리 주보(mock의 2026-08-10)에는 페이저를 아예 두지 않는다 */}
        {total > 1 && (
          <div className="absolute bottom-3 flex items-center gap-1 rounded-[var(--radius-button)] bg-[var(--color-navy-900)]/80 px-2 py-1 text-white">
            <button
              type="button"
              onClick={goPrev}
              disabled={!hasPrev}
              aria-label="이전 장"
              className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-white/10 disabled:opacity-25"
            >
              ‹
            </button>
            <span aria-live="polite" className="min-w-16 text-center text-sm font-bold">
              {index + 1} / {total}
            </span>
            <button
              type="button"
              onClick={goNext}
              disabled={!hasNext}
              aria-label="다음 장"
              className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-white/10 disabled:opacity-25"
            >
              ›
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 font-bold">{bulletinLabel(bulletin.serviceDate)}</p>
      {total > 1 && (
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          좌우로 넘기거나 ← → 키로 장을 이동할 수 있습니다. 확대는 두 손가락으로
          벌리면 됩니다.
        </p>
      )}
      {/*
        WIREFRAME §12의 `[ ⬇ 다운로드 ]`는 FR-BUL-04(장별 개별 다운로드)로
        별도 단위다. 동작하지 않는 버튼을 미리 두지 않는다.
      */}
    </div>
  );
}
