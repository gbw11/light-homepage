"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Bulletin } from "@/types/api";
import { usePinchZoom } from "@/lib/gesture/usePinchZoom";

/**
 * 스와이프로 인정할 최소 가로 이동량(px).
 * 라이트박스(`/photos/[id]/_components/Lightbox.tsx`)와 같은 값을 쓴다 —
 * 같은 제스처가 화면마다 다르게 느껴지지 않게 한다.
 */
const SWIPE_THRESHOLD = 50;

/**
 * 주보가 도착하기 전에 잡아둘 기본 비율 — A4 세로(1:1.414).
 *
 * 주보는 A4 문서를 스캔한 것이라 이 비율이 기본이다 (mock도 1448×2048 = 1:1.414).
 * 월례회 뷰어도 같은 이유로 `[aspect-ratio:1/1.414]`를 쓴다.
 * 실제 주보가 도착하면 그 장의 `width`/`height`로 정확히 다시 잡는다.
 */
const A4_PORTRAIT = "1 / 1.414";

/**
 * 뷰어가 차지할 **가로 크기**. "가로 100%"와 "높이가 80vh가 되는 가로" 중 작은 쪽.
 * 이러면 이미지가 실제로 그려질 크기와 상자가 같아진다.
 */
function viewerWidth(ratio: string): string {
  const [w, h] = ratio.split("/").map((v) => v.trim());
  return `min(100%, calc(80vh * ${w} / ${h}))`;
}

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
 * 핀치 줌·팬·더블탭 확대는 `usePinchZoom`이 맡는다 (FR-BUL-03, 2026-08-25 구현).
 * 라이트박스와 **같은 훅을 쓰므로 두 화면의 제스처가 어긋나지 않는다.**
 * 주보는 글자가 작아서 이미지만 확대하는 제스처가 특히 필요하다 — 페이지
 * 전체 확대로는 헤더·페이저까지 커져서 확대한 채로 장을 넘길 수 없다.
 */
export function BulletinViewer({ bulletin }: { bulletin: Bulletin }) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const zoom = usePinchZoom();

  const pages = bulletin.pages;
  const total = pages.length;
  const page = pages[index] ?? pages[0];

  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  /** 장을 넘길 때 확대를 푼다 — 남아 있으면 다음 장이 엉뚱한 위치에서 잘린다 */
  const goPrev = useCallback(() => {
    zoom.reset();
    setIndex((i) => Math.max(0, i - 1));
  }, [zoom]);

  const goNext = useCallback(() => {
    zoom.reset();
    setIndex((i) => Math.min(total - 1, i + 1));
  }, [total, zoom]);

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
      {/*
        이미지가 로드되기 **전에** 이 상자의 크기가 정해져야 한다 — 크기를
        이미지가 정하면 로드 전 0으로 접혀 있다가 펴지면서 아래를 밀어낸다.

        ⚠️ 다만 이 화면의 CLS를 만든 **주범은 이게 아니었다.** 주보 데이터
        자체를 클라이언트에서 가져오므로, 뷰어가 나타나기 전까지 자리가
        비어 있는 것이 훨씬 컸다 — 그건 `BulletinScreen`의 스켈레톤이 맡는다.
        (여기만 고쳤을 때 CLS는 0.278 → 0.279로 그대로였다.)
      */}
      <div
        style={
          // 서버가 치수를 안 주거나 0이면 예약을 포기하고 예전처럼 동작한다
          // (틀린 비율로 예약하는 것이 예약을 안 하는 것보다 나쁘다)
          page.width > 0 && page.height > 0
            ? {
                aspectRatio: `${page.width} / ${page.height}`,
                width: viewerWidth(`${page.width} / ${page.height}`),
              }
            : { maxHeight: "80vh" }
        }
        className="relative mx-auto flex items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-[var(--color-navy-100)]/30"
        onTouchStart={(e) => {
          zoom.handlers.onTouchStart(e);
          // 손가락 2개 이상 = 핀치 → 스와이프 판정을 포기하고 확대에 맡긴다
          if (e.touches.length !== 1) {
            touchStart.current = null;
            return;
          }
          touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchMove={zoom.handlers.onTouchMove}
        onTouchEnd={(e) => {
          zoom.handlers.onTouchEnd(e);
          const start = touchStart.current;
          touchStart.current = null;
          if (!start || e.touches.length > 0) return;
          // 확대 중에는 가로 이동이 '장 넘기기'가 아니라 '이미지 밀기'다
          if (zoom.isZoomed) return;

          const end = e.changedTouches[0];
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          // 세로로 더 많이 움직였으면 스와이프가 아니다 (스크롤·핀치 오판 방지)
          if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return;
          if (dx > 0) goPrev();
          else goNext();
        }}
        onDoubleClick={zoom.handlers.onDoubleClick}
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
          style={zoom.style}
          // 상자가 이미 정확한 크기다 — 이미지는 그 안을 채우기만 한다
          className="h-full w-full object-contain"
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

      {/*
        FR-BUL-04 · WIREFRAME §12의 `[ ⬇ 다운로드 ]`.

        **지금 보고 있는 장 하나를 내려받는다.** WIREFRAME §12에는 장 수와
        무관하게 버튼이 하나뿐이고 바로 위에 페이저(`‹ 1 / 2 ›`)가 있으므로,
        "현재 장"이 이 버튼의 자연스러운 대상이다. 장마다 버튼을 늘어놓거나
        전체 묶음(ZIP)을 만드는 쪽은 와이어프레임에 없고, FR-BUL-04이 요구하는
        "장별 개별 다운로드"도 장을 넘겨 각각 받는 것으로 충족된다.

        ⚠️ `api.bulletins.downloadUrl`은 **[CONTRACT] 미합의 엔드포인트**다
        (`lib/api/types.ts` 주석 · SPEC_API §5에 다운로드 경로가 없다).
        `pages[].url`은 열람용이라 `Content-Disposition`이 없어 브라우저가
        탭에서 열어버리므로 그걸 대신 쓰지 않는다.

        라이트박스(`/photos/[id]/_components/Lightbox.tsx`)와 같은 두 가지
        판단을 그대로 따른다:
        · fetch가 아니라 **앵커**다 — 실서비스 응답은 302 → R2 presigned(다른
          오리진)이므로 브라우저가 직접 이동해야 한다. fetch로 받으면
          리다이렉트를 따라가 파일 전체를 메모리에 담게 된다.
        · `download`에 **파일명을 주지 않는다** — 크로스 오리진 리다이렉트에서는
          속성값이 무시되고 서버의 `Content-Disposition`이 이름을 정한다.
          확장자를 추측해 붙이면 mock에서만 맞다.

        키보드: 앵커는 ←/→ 를 쓰지 않으므로 뷰어의 장 이동 핸들러와 겹치지
        않는다. Tab 순서는 페이저 → 이 버튼 순으로 화면 순서와 같다.
      */}
      <a
        href={api.bulletins.downloadUrl(bulletin.id, page.pageNo)}
        download
        aria-label={`${bulletinLabel(bulletin.serviceDate)} ${page.pageNo}장 다운로드`}
        className="mt-3 inline-flex min-h-11 items-center justify-center gap-1 rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
      >
        {/* 1장짜리 주보에서 "이 장"이라고 쓰면 고를 게 있는 것처럼 읽힌다 */}
        <span aria-hidden="true">⬇</span> {total > 1 ? "이 장 다운로드" : "다운로드"}
      </a>

      {total > 1 && (
        <p className="mt-2 text-sm text-[var(--color-gray-400)]">
          좌우로 넘기거나 ← → 키로 장을 이동할 수 있습니다. 확대는 두 손가락으로
          벌리면 됩니다. 다운로드는 지금 보고 있는 장({index + 1}/{total})을
          내려받습니다.
        </p>
      )}
    </div>
  );
}

/**
 * 주보가 도착하기 전 뷰어 자리를 잡아두는 스켈레톤.
 *
 * ⚠️ **이 화면 CLS(0.278)의 주범이 여기였다.** 주보 데이터를 클라이언트에서
 * 가져오는데(공개 열람 전환 후에도 그대로 뒀다 — 서버에서 부르면 백엔드 없는
 * 환경에서 정적 생성이 멈춘다) 로딩 표시가 **"불러오는 중..." 한 줄**이었다.
 * 그 한 줄이 뷰어로 바뀌는 순간 아래 내용이 통째로(푸터까지) 밀려났다.
 *
 * 뷰어와 **같은 구조·같은 크기**로 그려서 그 이동을 없앤다:
 * 상자(A4 비율) → 날짜 줄(`mt-4` + 24px) → 다운로드 버튼(`mt-3` + 44px).
 *
 * 남는 오차: 여러 장 주보에만 붙는 안내 문단(`mt-2` + 2줄)은 장 수를 알기 전이라
 * 예약하지 않는다. 그만큼(약 50px)은 로딩이 끝날 때 한 번 움직인다 —
 * 없애려면 장 수를 미리 알아야 하는데, 그건 이 화면이 가진 정보가 아니다.
 */
export function BulletinViewerSkeleton() {
  return (
    <div aria-hidden="true">
      <div
        style={{ aspectRatio: A4_PORTRAIT, width: viewerWidth(A4_PORTRAIT) }}
        className="mx-auto rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-[var(--color-navy-100)]/30"
      />
      {/* 날짜 줄 — 본문 기본 크기(줄높이 24px) */}
      <div className="mt-4 h-6 w-40 rounded bg-[var(--color-navy-100)]/60" />
      {/* 다운로드 버튼 — 실제 버튼과 같은 `min-h-11`(44px) */}
      <div className="mt-3 h-11 w-40 rounded-[var(--radius-button)] bg-[var(--color-navy-100)]/60" />
    </div>
  );
}
