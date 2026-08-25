"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 사진/문서 뷰어용 핀치 줌 + 팬 + 더블탭 줌 (FR-PHO-03 · FR-BUL-03).
 *
 * ## 왜 브라우저 기본 핀치로 충분하지 않은가
 *
 * 지금까지는 커스텀 제스처를 만들지 않고 브라우저의 페이지 확대에 맡겼다.
 * 그 판단의 근거는 "반쪽짜리 제스처 핸들러가 기본 동작까지 망치는 쪽이 더
 * 나쁘다"였고, 그건 지금도 맞다. 다만 페이지 확대는 **헤더·버튼까지 같이
 * 커져서** 확대한 상태로 다음 장으로 넘기거나 닫을 수가 없다. 주보처럼
 * 글자가 작은 문서에서는 그게 실제로 불편하다. 그래서 **이미지만** 확대하는
 * 제스처를 만든다.
 *
 * ## 규칙 (두 뷰어가 같게 동작해야 한다)
 *
 * · **확대 전에는 아무것도 가로채지 않는다.** `scale === 1`이면 터치 이벤트를
 *   그대로 흘려보내 기존 스와이프(장 넘기기)와 페이지 스크롤이 살아 있다.
 * · **확대 중에는 스와이프를 막는다.** 확대해서 왼쪽 끝을 보고 있는데 손가락을
 *   오른쪽으로 밀면 "이전 장"이 아니라 "이미지를 오른쪽으로 이동"이어야 한다.
 *   `isZoomed`로 호출부가 그 판단을 한다.
 * · **더블탭으로 2배 ↔ 원본.** 두 손가락이 어려운 사용자를 위한 대체 수단이다
 *   (NFR-A11Y — 제스처에 단일 포인터 대안을 둔다).
 * · **장을 넘기면 원래 크기로 돌아간다.** 확대 상태가 남아 있으면 다음 장이
 *   엉뚱한 위치에서 잘려 보인다 — `reset()`을 호출부가 인덱스 변경 시 부른다.
 * · 팬 범위를 이미지 밖으로 못 나가게 가둔다(`clamp`). 확대한 이미지를 화면
 *   밖으로 밀어내 빈 화면을 보게 되는 일을 막는다.
 *
 * ## 왜 Pointer Events가 아니라 Touch Events인가
 * 핀치는 **터치 전용**이고, 이 화면들은 이미 `onTouchStart`/`onTouchEnd`로
 * 스와이프를 처리한다. 한 화면에서 두 이벤트 모델을 섞으면 어느 쪽이 먼저
 * 오는지에 따라 동작이 갈린다. 마우스 사용자에게는 더블클릭이 더블탭과 같은
 * 핸들러로 동작한다.
 */

const MAX_SCALE = 3;
const DOUBLE_TAP_SCALE = 2;
/** 더블탭으로 인정할 최대 간격(ms) */
const DOUBLE_TAP_MS = 300;

type Offset = { x: number; y: number };

/**
 * 두 손가락 사이 거리. `React.Touch`와 DOM `Touch`가 다른 타입이라
 * (React 쪽에 `force`·`radiusX` 등이 없다) 실제로 쓰는 두 값만 받는다.
 */
type Point = { clientX: number; clientY: number };

function distance(a: Point, b: Point): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export type PinchZoom = {
  /** 1이면 원본 크기 */
  scale: number;
  offset: Offset;
  /** `scale > 1` — 호출부가 스와이프를 막을지 판단하는 데 쓴다 */
  isZoomed: boolean;
  /** 이미지에 그대로 얹는다 */
  style: { transform: string; transition: string; touchAction: "none" | "auto" };
  /** 확대 컨테이너에 얹는 핸들러들 */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onDoubleClick: () => void;
  };
  /** 원본 크기로 되돌린다 (장 넘길 때 호출) */
  reset: () => void;
};

export function usePinchZoom(): PinchZoom {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  /** 제스처가 진행 중인 동안은 transition을 끈다 — 손가락을 따라와야 한다 */
  const [animating, setAnimating] = useState(false);

  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const panStart = useRef<{ x: number; y: number; offset: Offset } | null>(null);
  const lastTap = useRef(0);

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    setAnimating(true);
  }, []);

  /**
   * 확대 배율에 따라 팬 가능 범위를 정한다 — 화면 절반까지만 밀 수 있다.
   * `scale <= 1`이면 원점을 돌려주므로, **확대를 푸는 순간 팬 위치도 함께
   * 초기화된다** (별도 보정 effect가 필요 없다).
   */
  const clamp = useCallback((next: Offset, currentScale: number): Offset => {
    if (currentScale <= 1) return { x: 0, y: 0 };
    const limit = 150 * (currentScale - 1);
    return {
      x: Math.max(-limit, Math.min(limit, next.x)),
      y: Math.max(-limit, Math.min(limit, next.y)),
    };
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 2) {
        setAnimating(false);
        pinchStart.current = {
          dist: distance(e.touches[0], e.touches[1]),
          scale,
        };
        panStart.current = null;
        return;
      }

      if (e.touches.length === 1) {
        // 더블탭 판정 — 확대 중이 아니어도 동작해야 한다
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          lastTap.current = 0;
          setAnimating(true);
          setScale((s) => (s > 1 ? 1 : DOUBLE_TAP_SCALE));
          setOffset({ x: 0, y: 0 });
          return;
        }
        lastTap.current = now;

        // 확대 상태에서만 팬을 시작한다. 원본 크기일 때는 스와이프가 우선이다
        if (scale > 1) {
          setAnimating(false);
          panStart.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
            offset,
          };
        }
      }
    },
    [scale, offset],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const pinch = pinchStart.current;
      if (pinch && e.touches.length === 2) {
        const next = (distance(e.touches[0], e.touches[1]) / pinch.dist) * pinch.scale;
        const clampedScale = Math.max(1, Math.min(MAX_SCALE, next));
        setScale(clampedScale);
        setOffset((o) => clamp(o, clampedScale));
        return;
      }

      const pan = panStart.current;
      if (pan && e.touches.length === 1) {
        setOffset(
          clamp(
            {
              x: pan.offset.x + (e.touches[0].clientX - pan.x),
              y: pan.offset.y + (e.touches[0].clientY - pan.y),
            },
            scale,
          ),
        );
      }
    },
    [clamp, scale],
  );

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      pinchStart.current = null;
      panStart.current = null;
      setAnimating(true);
    }
  }, []);

  const onDoubleClick = useCallback(() => {
    setAnimating(true);
    setScale((s) => (s > 1 ? 1 : DOUBLE_TAP_SCALE));
    setOffset({ x: 0, y: 0 });
  }, []);

  return {
    scale,
    offset,
    isZoomed: scale > 1,
    style: {
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
      transition: animating ? "transform 180ms ease-out" : "none",
      /**
       * 확대 중에만 브라우저 기본 제스처를 끈다. 원본 크기에서 `none`으로 두면
       * 페이지 스크롤이 죽어서 뷰어 아래 내용을 볼 수 없다.
       */
      touchAction: scale > 1 ? "none" : "auto",
    },
    handlers: { onTouchStart, onTouchMove, onTouchEnd, onDoubleClick },
    reset,
  };
}
