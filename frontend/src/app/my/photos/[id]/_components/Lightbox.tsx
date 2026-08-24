"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "@/types/api";
import { PhotoReportForm } from "./PhotoReportForm";

/** 스와이프로 인정할 최소 가로 이동량(px) */
const SWIPE_THRESHOLD = 50;

type LightboxProps = {
  /** 현재까지 로드된 사진들 — 인덱스 기준은 이 배열이다 */
  photos: Photo[];
  /**
   * 앨범 전체 장수 (`§6.1`의 `photoCount`). 위치 표시(`12 / 47`)의 분모로 쓴다 —
   * 아직 커서로 다 받지 않았어도 사용자에게는 앨범 전체 기준이 자연스럽다.
   * 모르면 생략하고 로드된 장수를 쓴다.
   */
  totalCount?: number;
  index: number;
  onIndexChange: (next: number) => void;
  onClose: () => void;
  /** 마지막 장에 도달했을 때 다음 커서를 요청한다 (무한 스크롤과 동일 소스) */
  onReachEnd?: () => void;
};

/**
 * WIREFRAME.md §13-4 — 확대 보기(라이트박스).
 *
 * · 표시 이미지는 `viewUrl`(2560px)을 쓴다. 그리드의 `thumbUrl`과 다르다
 *   (SPEC_API §6.4 — 열람 전송량 때문에 그리드에는 절대 쓰지 않는다).
 * · 사진 비율이 섞여 있어(4:3 · 16:9 · 세로 1200x1600) `object-contain` +
 *   `max-h`/`max-w`로 어떤 비율이든 잘리지 않고 화면에 들어오게 한다.
 *
 * ⚠️ 핀치 줌: **커스텀 제스처를 구현하지 않았다.** 뷰포트 메타에
 * `user-scalable=no`를 두지 않았으므로 브라우저의 기본 핀치 줌(페이지 확대)이
 * 그대로 동작한다. 사진만 확대되는 전용 줌(더블탭 줌·팬 포함)은 별도 단위로
 * 분리한다 — 반쪽짜리 제스처 핸들러가 기본 동작까지 망치는 쪽이 더 나쁘다.
 * 그래서 터치 핸들러는 손가락이 2개 이상이면 전부 무시한다(핀치 방해 금지).
 */
export function Lightbox({
  photos,
  totalCount,
  index,
  onIndexChange,
  onClose,
  onReachEnd,
}: LightboxProps) {
  const photo = photos[index];
  const total = totalCount ?? photos.length;
  /** `⋮` → 신고·요청 패널 (WIREFRAME §13-4, SPEC_API §6.10) */
  const [reportOpen, setReportOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  /** 사진을 넘길 때 열려 있던 신고 패널은 닫는다 (다른 사진에 요청이 붙지 않게) */
  const goPrev = useCallback(() => {
    if (index === 0) return;
    setReportOpen(false);
    onIndexChange(index - 1);
  }, [index, onIndexChange]);

  const goNext = useCallback(() => {
    if (index >= photos.length - 1) return;
    setReportOpen(false);
    onIndexChange(index + 1);
  }, [index, photos.length, onIndexChange]);

  /** 끝에 가까워지면 다음 페이지를 미리 받아둔다 (그리드 sentinel과 같은 역할) */
  useEffect(() => {
    if (onReachEnd && index >= photos.length - 3) onReachEnd();
  }, [index, photos.length, onReachEnd]);

  /** 배경 스크롤 잠금 — 열려 있는 동안 body 스크롤을 막고, 닫을 때 되돌린다 */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  /**
   * 포커스 관리: 열릴 때 다이얼로그로 포커스를 옮기고, 닫힐 때 원래 있던
   * 요소(클릭한 썸네일)로 되돌린다. Tab은 다이얼로그 안에서만 순환한다.
   */
  useEffect(() => {
    const restoreTo = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => restoreTo?.focus?.();
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // 신고 패널이 열려 있으면 사진 이동·닫기 키는 패널이 우선한다
      if (reportOpen && e.key !== "Tab") return;

      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
        return;
      }
      if (e.key !== "Tab") return;

      // 포커스 트랩 — 다이얼로그 밖으로 Tab이 새지 않게 앞뒤를 이어붙인다
      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input, textarea, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext, reportOpen]);

  if (!photo) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`사진 확대 보기 ${index + 1} / ${total}`}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black/95 outline-none"
      onTouchStart={(e) => {
        // 손가락 2개 이상 = 핀치 → 브라우저 기본 동작에 맡기고 스와이프 판정을 포기한다
        if (reportOpen || e.touches.length !== 1) {
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
      <div className="flex shrink-0 items-center justify-between p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white hover:bg-white/10"
        >
          ✕
        </button>

        {/*
          WIREFRAME §13-4의 `⋮`. 지금 이 메뉴의 항목은 신고·요청 하나뿐이므로
          중간 단계 메뉴를 두지 않고 바로 요청 패널을 연다 (`⬇ 원본 다운로드`는
          별도 단위 — SPEC_API §6.7).
        */}
        <button
          type="button"
          onClick={() => setReportOpen(true)}
          aria-label="사진 신고 · 삭제 요청"
          aria-expanded={reportOpen}
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white hover:bg-white/10"
        >
          ⋮
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        <button
          type="button"
          onClick={goPrev}
          disabled={!hasPrev}
          aria-label="이전 사진"
          className="absolute left-1 z-10 flex h-14 w-11 items-center justify-center rounded-full text-3xl text-white hover:bg-white/10 disabled:opacity-25"
        >
          ‹
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element -- 실서비스 URL은 R2 presigned(만료·서명 포함)라 next/image 최적화 대상이 아니다 (SPEC_API §6.4) */}
        <img
          key={photo.id}
          src={photo.viewUrl}
          alt={`사진 ${index + 1}`}
          width={photo.width}
          height={photo.height}
          className="max-h-full max-w-full object-contain"
        />

        <button
          type="button"
          onClick={goNext}
          disabled={!hasNext}
          aria-label="다음 사진"
          className="absolute right-1 z-10 flex h-14 w-11 items-center justify-center rounded-full text-3xl text-white hover:bg-white/10 disabled:opacity-25"
        >
          ›
        </button>
      </div>

      <p
        aria-live="polite"
        className="shrink-0 py-5 text-center text-sm font-bold text-white"
      >
        {index + 1} / {total}
      </p>

      {reportOpen && (
        <PhotoReportForm photoId={photo.id} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
