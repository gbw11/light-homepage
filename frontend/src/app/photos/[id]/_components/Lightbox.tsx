"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import { useAuth } from "@/components/providers/AuthProvider";
import type { Photo } from "@/types/api";
import { PhotoDeletePanel } from "./PhotoDeletePanel";
import { PhotoReportForm } from "./PhotoReportForm";
import { usePinchZoom } from "@/lib/gesture/usePinchZoom";

/** 스와이프로 인정할 최소 가로 이동량(px) */
const SWIPE_THRESHOLD = 50;

/**
 * SPEC_FUNCTIONAL §5.1 (FR-PHO-04) — 보관되는 최대 화질은 **장변 2560px**이고
 * 촬영 원본은 보관하지 않는다. 스펙의 경계값이므로 여기서만 정의하고 문구를
 * 여기서 만든다 — mock 자산은 git에 커밋된 데모 데이터라 1600px이지만, 그건
 * 데모의 사정이고 회원에게 약속하는 경계는 실서비스 기준(2560px)이다.
 * 그래서 이 사진의 실제 크기는 `Photo.width/height`로 따로 보여준다.
 */
const MAX_STORED_LONG_EDGE = 2560;

/**
 * `⋮`로 열리는 겹침 패널. 라이트박스는 한 번에 하나만 띄운다 — 두 개를 따로
 * boolean으로 들고 있으면 "신고 패널 위에 삭제 패널"이 가능해진다.
 */
type Overlay = "none" | "actions" | "report" | "delete";

type LightboxProps = {
  /** 앨범 id — 사진 삭제 후 캐시 무효화에 쓴다 (SPEC_API §6.9) */
  albumId: string;
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
  /** 사진 삭제 성공 — 라이트박스를 닫고 목록에 결과를 안내한다 (FR-PHO-09) */
  onPhotoDeleted: (message: string) => void;
};

/**
 * WIREFRAME.md §13-4 — 확대 보기(라이트박스).
 *
 * · 표시 이미지는 `viewUrl`(2560px)을 쓴다. 그리드의 `thumbUrl`과 다르다
 *   (SPEC_API §6.4 — 열람 전송량 때문에 그리드에는 절대 쓰지 않는다).
 * · 사진 비율이 섞여 있어(4:3 · 16:9 · 세로 1200x1600) `object-contain` +
 *   `max-h`/`max-w`로 어떤 비율이든 잘리지 않고 화면에 들어오게 한다.
 *
 * 핀치 줌·팬·더블탭 확대는 `usePinchZoom`이 맡는다 (FR-PHO-03, 2026-08-25 구현).
 * 주보 뷰어와 **같은 훅을 쓰므로 두 화면의 제스처가 어긋나지 않는다.**
 * 확대 중에는 가로 스와이프가 '다음 사진'이 아니라 '이미지 밀기'가 된다 —
 * 확대해서 왼쪽 끝을 보다가 오른쪽으로 밀면 사진이 넘어가면 안 된다.
 */
export function Lightbox({
  albumId,
  photos,
  totalCount,
  index,
  onIndexChange,
  onClose,
  onReachEnd,
  onPhotoDeleted,
}: LightboxProps) {
  const photo = photos[index];
  const total = totalCount ?? photos.length;
  /** `⋮`로 여는 겹침 패널 (WIREFRAME §13-4) */
  const [overlay, setOverlay] = useState<Overlay>("none");
  const { user } = useAuth();
  /**
   * 사진 삭제는 임원(`L`) 이상만 (SPEC_API §6.9). 권한이 없으면 `⋮`의 항목이
   * 신고·요청 하나뿐이라 중간 메뉴 없이 바로 그 패널을 연다 — 아래 `⋮` 핸들러.
   * 화면에서 감추는 건 UI 편의이고 실제 인가는 서버가 한다 (`RequireLeader` 주석).
   */
  const canDelete = !!user && isLeaderOrAbove(user.role);
  const overlayOpen = overlay !== "none";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const zoom = usePinchZoom();

  const hasPrev = index > 0;
  const hasNext = index < photos.length - 1;

  /**
   * 사진을 넘길 때 열려 있던 패널은 닫는다 — 다른 사진에 요청이 붙거나,
   * 더 나쁘게는 **다른 사진을 지우게 되는** 것을 막는다 (FR-PHO-09).
   */
  const goPrev = useCallback(() => {
    if (index === 0) return;
    setOverlay("none");
    zoom.reset();
    onIndexChange(index - 1);
  }, [index, onIndexChange, zoom]);

  const goNext = useCallback(() => {
    if (index >= photos.length - 1) return;
    setOverlay("none");
    zoom.reset();
    onIndexChange(index + 1);
  }, [index, photos.length, onIndexChange, zoom]);

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

  /**
   * 키 핸들러는 ref로 항상 최신을 가리키고, window 리스너는 마운트에 한 번만
   * 붙인다. 핸들러를 effect 의존성에 두면 goPrev/goNext가 index마다 새로
   * 만들어져 **화살표 키를 누를 때마다** 리스너가 떼었다 붙는다.
   */
  const keydownRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // 겹침 패널이 열려 있으면 사진 이동·닫기 키는 패널이 우선한다
      if (overlayOpen && e.key !== "Tab") return;

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

    keydownRef.current = onKeyDown;
  }, [onClose, goPrev, goNext, overlayOpen]);

  useEffect(() => {
    const listener = (e: KeyboardEvent) => keydownRef.current(e);
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

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
        // 겹침 패널이 열려 있으면 제스처를 전부 패널에 맡긴다
        if (overlayOpen) {
          touchStart.current = null;
          return;
        }
        zoom.handlers.onTouchStart(e);
        // 손가락 2개 이상 = 핀치 → 스와이프 판정을 포기하고 확대에 맡긴다
        if (e.touches.length !== 1) {
          touchStart.current = null;
          return;
        }
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }}
      onTouchMove={(e) => {
        if (overlayOpen) return;
        zoom.handlers.onTouchMove(e);
      }}
      onTouchEnd={(e) => {
        if (overlayOpen) return;
        zoom.handlers.onTouchEnd(e);
        const start = touchStart.current;
        touchStart.current = null;
        if (!start || e.touches.length > 0) return;
        // 확대 중에는 가로 이동이 '다음 사진'이 아니라 '이미지 밀기'다
        if (zoom.isZoomed) return;

        const end = e.changedTouches[0];
        const dx = end.clientX - start.x;
        const dy = end.clientY - start.y;
        // 세로로 더 많이 움직였으면 스와이프가 아니다 (스크롤·핀치 오판 방지)
        if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
        if (dx > 0) goPrev();
        else goNext();
      }}
      onDoubleClick={() => {
        if (!overlayOpen) zoom.handlers.onDoubleClick();
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

        <div className="flex items-center gap-1">
          {/*
            `⬇` 개별 다운로드 (WIREFRAME §13-4 — "회원의 가장 중요한 동작",
            FR-PHO-04). `api.photos.downloadUrl`은 fetch가 아니라 URL 빌더다:
            실서비스는 302 → presigned(`Content-Disposition: attachment`)이므로
            **브라우저가 직접 이동**해야 한다. 그래서 앵커를 쓴다 — fetch로
            받으면 리다이렉트를 따라가 파일 전체를 메모리에 담게 된다.

            `download`에 파일명을 지정하지 않는다: 실서비스 응답은 R2(다른
            오리진)로 넘어가므로 `download` 속성값이 무시되고 서버의
            `Content-Disposition`이 파일명을 정한다. 여기서 확장자를 추측해
            붙이면 mock에서만 맞고 실서비스에서는 틀린 이름이 된다.
          */}
          <a
            href={api.photos.downloadUrl(photo.id)}
            download
            aria-label={`사진 ${index + 1} 다운로드`}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white hover:bg-white/10"
          >
            ⬇
          </a>

          {/*
            WIREFRAME §13-4의 `⋮`.
            · 익명·일반 회원: 항목이 신고·요청 하나뿐이라 중간 메뉴 없이 바로 연다.
              익명에게도 보여준다 — 사진에 얼굴이 찍힌 비회원이 '내려달라'고
              알릴 유일한 창구다 (PM 결정 2026-08-25).
            · 임원 이상: 삭제(§6.9)가 붙어 항목이 둘이므로 메뉴를 한 단계 둔다.
              파괴적 동작을 헤더의 `⬇` 옆에 나란히 놓지 않는 것이 목적이다 —
              다운로드를 누르려던 손가락이 삭제에 닿으면 안 된다.
          */}
          <button
            type="button"
            onClick={() => setOverlay(canDelete ? "actions" : "report")}
            aria-label={canDelete ? "사진 작업 메뉴" : "사진 신고 · 삭제 요청"}
            aria-expanded={overlayOpen}
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white hover:bg-white/10"
          >
            ⋮
          </button>
        </div>
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
          decoding="async"
          style={zoom.style}
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

        {/*
          이웃 사진 미리 받기 — viewUrl(2560px)은 수백 KB라 화살표를 누른 뒤에
          받기 시작하면 빈 화면이 한 박자 보인다. display:none이어도 브라우저는
          src를 받아두므로, 넘기는 순간 캐시에서 바로 뜬다.
        */}
        {hasPrev && (
          // eslint-disable-next-line @next/next/no-img-element -- presigned URL 프리로드 (위 본문 img와 같은 이유)
          <img src={photos[index - 1].viewUrl} alt="" aria-hidden className="hidden" />
        )}
        {hasNext && (
          // eslint-disable-next-line @next/next/no-img-element -- presigned URL 프리로드 (위 본문 img와 같은 이유)
          <img src={photos[index + 1].viewUrl} alt="" aria-hidden className="hidden" />
        )}
      </div>

      <div className="shrink-0 px-5 py-5 text-center">
        <p aria-live="polite" className="text-sm font-bold text-white">
          {index + 1} / {total}
        </p>
        {/*
          FR-PHO-04 수용 기준 — "이 경계를 화면에 안내한다".
          안내하지 않으면 회원은 인쇄·보정용 촬영 원본을 기대한다.
        */}
        <p className="mt-1 text-xs leading-relaxed text-white/60">
          {photo.width} × {photo.height}px · 보관 화질은 장변 최대{" "}
          {MAX_STORED_LONG_EDGE}px입니다 (촬영 원본은 보관하지 않습니다)
        </p>
      </div>

      {overlay === "actions" && (
        <PhotoActionsMenu
          position={index + 1}
          onReport={() => setOverlay("report")}
          onDelete={() => setOverlay("delete")}
          onClose={() => setOverlay("none")}
        />
      )}

      {overlay === "report" && (
        <PhotoReportForm photoId={photo.id} onClose={() => setOverlay("none")} />
      )}

      {overlay === "delete" && (
        <PhotoDeletePanel
          albumId={albumId}
          photoId={photo.id}
          position={index + 1}
          total={total}
          onClose={() => setOverlay("none")}
          onDeleted={(message) => {
            setOverlay("none");
            // 지운 사진을 계속 띄워둘 수 없다 — 라이트박스를 닫고 목록에서 결과를 알린다
            onClose();
            onPhotoDeleted(message);
          }}
        />
      )}
    </div>
  );
}

/**
 * `⋮` 액션 메뉴 (임원 이상에만 렌더 — 호출부 참고).
 *
 * 삭제를 헤더 아이콘으로 직접 노출하지 않고 이 한 단계를 두는 이유:
 * 헤더에는 `⬇`(다운로드)가 이미 있고, 44px 아이콘 두 개가 붙어 있으면
 * "받으려다 지운다"가 실제로 일어난다. 메뉴 안에서는 항목마다 글자 라벨이
 * 있고 삭제는 빨간색으로 분리돼 있어 무엇을 누르는지가 분명하다.
 */
function PhotoActionsMenu({
  position,
  onReport,
  onDelete,
  onClose,
}: {
  position: number;
  onReport: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`사진 ${position} 작업 메뉴`}
      className="absolute inset-x-0 bottom-0 z-20 max-h-full overflow-y-auto rounded-t-[var(--radius-card)] bg-[var(--background)] p-5"
      onKeyDown={(e) => {
        // 라이트박스의 ←/→·Esc가 메뉴 위에서 동작하지 않게 막는다
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <p className="text-sm font-bold text-[var(--color-gray-400)]">사진 {position}</p>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={onReport}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] px-3 text-left text-base font-bold hover:bg-[var(--color-navy-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
        >
          신고 · 삭제 요청
        </button>
        {/* 접근성: 이름이 "삭제"만이면 무엇이 지워지는지 알 수 없다 */}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`${position}번째 사진 삭제 (되돌릴 수 없음)`}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] px-3 text-left text-base font-bold text-[var(--color-red-500)] hover:bg-[var(--color-red-500)]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red-500)]"
        >
          사진 삭제 · 되돌릴 수 없음
        </button>
        <button
          type="button"
          onClick={onClose}
          className="mt-1 inline-flex min-h-11 items-center rounded-[var(--radius-card)] px-3 text-left text-base font-bold text-[var(--color-gray-400)] hover:bg-[var(--color-navy-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
        >
          닫기
        </button>
      </div>
    </div>
  );
}
