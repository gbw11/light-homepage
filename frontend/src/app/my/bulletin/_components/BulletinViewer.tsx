"use client";

import { useState } from "react";
import type { Bulletin } from "@/types/api";

/** `2026-08-24` → `2026-08-24 주보` (WIREFRAME §12 표기) */
function bulletinLabel(serviceDate: string): string {
  return `${serviceDate} 주보`;
}

/**
 * WIREFRAME.md §12 — 주보 뷰어. 여러 장이면 `‹ 1 / 2 ›`로 장을 넘긴다.
 *
 * ⚠️ **로딩 전략이 사진첩과 반대다.** 주보는 글자가 작아 썸네일로는 읽을 수
 * 없으므로(FR-BUL-03 · SPEC_API §5.1) `pages[].url`(장변 2048px)을 처음부터
 * 그대로 로드한다. `thumbUrl`은 지난 주보 목록 행에서만 쓴다.
 *
 * ⚠️ 핀치 줌: 라이트박스(`/my/photos/[id]/_components/Lightbox.tsx`)와 같은
 * 판단으로 **커스텀 제스처를 구현하지 않았다.** 뷰포트에 `user-scalable=no`가
 * 없어 브라우저 기본 핀치 줌이 그대로 동작한다 — 반쪽짜리 제스처 핸들러가
 * 기본 동작까지 망치는 쪽이 더 나쁘다. WIREFRAME §12의 "핀치 줌"은 이 기본
 * 동작으로 충족한다.
 */
export function BulletinViewer({ bulletin }: { bulletin: Bulletin }) {
  const [index, setIndex] = useState(0);
  const pages = bulletin.pages;
  const page = pages[index] ?? pages[0];
  const total = pages.length;

  if (!page) return null;

  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  return (
    <div>
      <div className="relative flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-[var(--color-navy-100)]/30">
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
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
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
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
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
      {/*
        WIREFRAME §12의 `[ ⬇ 다운로드 ]`는 FR-BUL-04(장별 개별 다운로드)로
        별도 단위다. 동작하지 않는 버튼을 미리 두지 않는다.
      */}
    </div>
  );
}
