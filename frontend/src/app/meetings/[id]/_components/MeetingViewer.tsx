"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import type { MeetingDetail } from "@/types/api";
import { MEETING_STATUS_LABEL, formatRemaining } from "../../_components/meetingFormat";

/**
 * 스와이프로 인정할 최소 가로 이동량(px).
 * 주보 뷰어·라이트박스와 같은 값을 쓴다 — 같은 제스처가 화면마다 다르게
 * 느껴지지 않게 한다.
 */
const SWIPE_THRESHOLD = 50;

/** 입력 중인 곳에서는 화살표 키를 가로채지 않는다 (주보 뷰어와 동일) */
function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** `010-1234-5678` → `5678`. 워터마크에 무엇이 박히는지 알려주기 위한 표시용 */
function phoneTail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-4);
}

/**
 * 카운트다운 표시. 잎 컴포넌트로 분리한 이유: 매초 바뀌는 건 이 문구뿐인데
 * 상태가 뷰어에 있으면 **1초마다 뷰어 전체**(페이지 이미지·오버레이 포함)가
 * 리렌더된다. 부모는 만료 순간에 `onExpired`로 한 번만 알림받는다.
 *
 * **서버가 준 `remainingSeconds`를 기준점으로 삼고** 경과 시간을 빼는
 * 방식이다 — 매초 `setState(prev - 1)`로 줄이면 탭이 백그라운드로 가서
 * 타이머가 밀리는 만큼 실제보다 늦게 간다.
 */
function RemainingCountdown({
  baseSeconds,
  onExpired,
}: {
  baseSeconds: number;
  onExpired: () => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (baseSeconds <= 0) return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [baseSeconds]);
  const remaining = Math.max(0, baseSeconds - elapsed);

  const onExpiredRef = useRef(onExpired);
  useEffect(() => {
    onExpiredRef.current = onExpired;
  });
  useEffect(() => {
    if (remaining <= 0) onExpiredRef.current();
  }, [remaining]);

  return (
    <>
      <span aria-hidden>⏳</span> {formatRemaining(remaining)}
    </>
  );
}

/**
 * WIREFRAME.md §14b-2 · FR-MTG-02/03 — 월례회 자료 뷰어.
 *
 * ## 이미지를 어떻게 얻는가
 * `api.meetings.pageUrl(id, pageNo)`는 **fetch 대상이 아니라 `<img src>`에
 * 그대로 꽂는 엔드포인트 URL**이다 (SPEC_API §7.3). 서버가 R2 원본에
 * 워터마크(이름·연락처 뒷4자리·열람시각·문서ID)를 **합성해서 스트리밍**하고
 * `Cache-Control: no-store`를 붙인다. 그래서 여기서는
 *   · blob/canvas로 받아오지 않는다 (받는 순간 공유 가능한 사본이 된다)
 *   · URL을 state·localStorage에 저장하지 않고 렌더 때마다 만든다
 *   · presigned URL을 쓰지 않는다 (§7 preamble — 기간이 끝나도 살아있게 된다)
 *
 * ## 워터마크는 CSS로 얹지 않는다
 * 화면에 오버레이로 얹은 워터마크는 개발자도구에서 두 번 클릭이면 사라진다.
 * 아무 보호도 아니면서 "보호된다"는 착각만 만든다 (SPEC_FUNCTIONAL §6.2
 * FR-MTG-03). 워터마크는 서버가 픽셀에 태워서 보낸다 — 여기서 하는 일은
 * **그 사실을 사용자에게 알려주는 것**뿐이고, 그게 실제 억제력이다.
 *
 * ## 저장 제스처 차단은 "마찰"이다 (ARCHITECTURE §7.7 통제 #4 "약함")
 * 우클릭·드래그·롱프레스를 막지만 이건 무심한 저장을 한 번 되묻는 수준이고
 * **개발자도구로 몇 초면 우회된다.** 캡처·다른 기기 촬영은 어떤 방법으로도
 * 막을 수 없다. 그래서 화면 문구로 "막았다"고 말하지 않는다 — 와이어프레임의
 * "저장·캡처 없이 열람만 가능합니다"를 그대로 쓰지 않고 아래 하단 안내처럼
 * 사실만 적었다.
 *
 * 제스처·키보드 규칙은 주보 뷰어(`my/bulletin/_components/BulletinViewer.tsx`)
 * 를 그대로 따른다: 임계값 50px, 세로로 더 많이 움직였으면 스와이프가 아니고,
 * 손가락이 2개 이상이면 판정을 포기한다(브라우저 기본 핀치 줌 보호).
 */
export function MeetingViewer({ detail }: { detail: MeetingDetail }) {
  /*
    월례회 열람은 M(회원) 전용이라 이 컴포넌트는 항상 `MemberGate`
    (`app/meetings/[id]/page.tsx`) 안에서만 렌더된다 — `user`는 아래
    워터마크 문구에서 쓰는 시점에 항상 존재한다 (SPEC_API §10 매트릭스,
    DB `meeting_doc_views.member_id NOT NULL`). 익명 열람 분기는
    2026-08-25 결정으로 없어졌다 (BE 지적, FE-2) — 지우지 않고 남아
    있으면 "로그인 안 하면 이름이 안 박힌다"는 잘못된 안심을 준다.
  */
  const { user } = useAuth();
  const total = detail.pageCount;

  /** 페이지 번호는 1-based다 (`§7.3`의 `pageNo`) */
  const [pageNo, setPageNo] = useState(1);
  /** 같은 URL로 다시 시도하기 위한 `key` 갱신용. URL 자체는 건드리지 않는다 */
  const [retry, setRetry] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  /**
   * 이미지 로드 상태를 **어느 페이지의 상태인지와 함께** 들고 있는다.
   * 페이지를 넘길 때 effect로 "loading"으로 되돌리면 렌더가 한 번 더 돌고,
   * 그 사이 이전 페이지의 결과가 잠깐 보인다. 키가 다르면 곧바로
   * "loading"으로 읽는 편이 정확하다.
   */
  const imageKey = `${pageNo}-${retry}`;
  const [loadState, setLoadState] = useState<{
    key: string;
    state: "loaded" | "error";
  } | null>(null);
  const imageState = loadState?.key === imageKey ? loadState.state : "loading";

  const hasPrev = pageNo > 1;
  const hasNext = pageNo < total;

  const goPrev = useCallback(() => setPageNo((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPageNo((p) => Math.min(total, p + 1)), [total]);

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

  /**
   * 만료 여부만 이 컴포넌트가 든다 — 매초 도는 카운트다운은
   * `RemainingCountdown`(잎)이 맡고, 만료 순간에 한 번만 여기로 올라온다.
   */
  const [expired, setExpired] = useState(detail.remainingSeconds <= 0);
  const markExpired = useCallback(() => setExpired(true), []);

  /** 기간 밖인데 열람 중 = 임원(§7.1). 카운트다운 대신 그 사실을 밝힌다 */
  const leaderOverride = detail.status !== "OPEN";
  /** 열람 중에 기간이 끝난 경우 (§7.3이 다음 페이지부터 403을 준다) */
  const justExpired = !leaderOverride && expired;

  const src = api.meetings.pageUrl(detail.id, pageNo);

  return (
    <div className="select-none">
      <header className="flex items-center gap-3">
        <Link
          href="/meetings"
          aria-label="목록으로 닫기"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-2xl hover:bg-[var(--color-navy-100)]"
        >
          ✕
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">{detail.title}</h1>
        {leaderOverride ? (
          <span className="shrink-0 rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-3 py-1 text-xs font-bold">
            {MEETING_STATUS_LABEL[detail.status]} · 임원 열람
          </span>
        ) : (
          <span
            aria-live="polite"
            className="shrink-0 text-sm font-bold text-[var(--color-gray-400)]"
          >
            <RemainingCountdown
              baseSeconds={detail.remainingSeconds}
              onExpired={markExpired}
            />
          </span>
        )}
      </header>

      {justExpired && (
        <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-red-500)] p-3 text-sm text-[var(--color-red-500)]">
          열람 기간이 방금 종료되었습니다. 지금 열려 있는 페이지 외에는 더 볼 수
          없습니다.
        </p>
      )}

      <div
        // 문서 페이지는 세로로 길어서 데스크톱에서 폭을 다 쓰면 프레임 높이가
        // 화면을 넘어간다. 읽기 좋은 폭으로 묶는다
        className="relative mx-auto mt-4 flex w-full max-w-[36rem] items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-[var(--color-navy-100)]/30"
        onTouchStart={(e) => {
          // 손가락 2개 이상 = 핀치 → 브라우저 기본 동작에 맡기고 판정을 포기한다
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
        // 마찰용(위 주석 참고). 막았다고 판단하지 않는다
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {/*
          크기를 API가 주지 않아(§7.2에 width/height가 없다) A4 세로 비율로
          자리를 미리 잡는다 — 이미지가 뜨는 순간 레이아웃이 밀리지 않게
          (COMPONENTS.md §6.3). 실제 비율이 다르면 `object-contain`이 맞춰준다.
        */}
        <div className="relative flex w-full max-h-[80vh] items-center justify-center [aspect-ratio:1/1.414]">
          {imageState === "error" ? (
            <div className="p-6 text-center">
              <p className="text-4xl" aria-hidden>
                🚫
              </p>
              <p className="mt-4 font-bold">
                {pageNo}페이지를 불러오지 못했습니다
              </p>
              <p className="mt-2 text-sm text-[var(--color-gray-400)]">
                열람 기간이 끝났거나, 로그인이 만료됐거나, 네트워크가 끊겼을 수
                있습니다. 페이지 이미지는 서버가 매번 권한을 다시 확인한 뒤
                보내줍니다.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setRetry((r) => r + 1)}
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-5 text-sm font-bold text-[var(--color-ink)]"
                >
                  다시 시도
                </button>
                <Link
                  href="/meetings"
                  className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] px-5 text-sm font-bold underline"
                >
                  목록으로
                </Link>
              </div>
            </div>
          ) : (
            <>
              {imageState === "loading" && (
                <p className="absolute text-sm text-[var(--color-gray-400)]">
                  {pageNo}페이지를 불러오는 중...
                </p>
              )}
              {/*
                eslint-disable-next-line은 아래 img에 붙는다 — next/image를
                쓰지 않는 이유: 이 URL은 최적화 대상이 아니다. 서버가 열람자별로
                워터마크를 합성해 `no-store`로 스트리밍하므로 캐시·재최적화가
                오히려 유출 경로가 된다 (SPEC_API §7.3).
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={`${pageNo}-${retry}`}
                src={src}
                alt={`${detail.title} ${pageNo}페이지`}
                draggable={false}
                loading="eager"
                fetchPriority="high"
                onLoad={() => setLoadState({ key: imageKey, state: "loaded" })}
                // mock 모드에는 스트리밍할 서버가 없어 반드시 여기로 온다 (의도된 동작)
                onError={() => setLoadState({ key: imageKey, state: "error" })}
                // iOS 롱프레스 저장 콜아웃 억제. Tailwind에 해당 유틸이 없어
                // 인라인으로 준다 (역시 마찰 수준의 통제다)
                style={{ WebkitTouchCallout: "none" }}
                className={`max-h-[80vh] w-auto max-w-full object-contain ${
                  imageState === "loaded" ? "" : "invisible"
                }`}
              />
              {/*
                WIREFRAME §14b-2 "이미지 위에 투명 오버레이" — 롱프레스 저장
                메뉴가 이미지에 직접 닿지 않게 한다. 터치 이벤트는 부모로
                버블링되므로 스와이프는 그대로 동작한다. 어디까지나 마찰이고,
                개발자도구로 지우면 끝이다.
              */}
              <span aria-hidden className="absolute inset-0" />
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={!hasPrev}
          aria-label="이전 페이지"
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-[var(--color-navy-100)] disabled:opacity-25"
        >
          ‹
        </button>
        <span aria-live="polite" className="min-w-20 text-center text-sm font-bold">
          {pageNo} / {total}
        </span>
        <button
          type="button"
          onClick={goNext}
          disabled={!hasNext}
          aria-label="다음 페이지"
          className="flex h-11 w-11 items-center justify-center rounded-full text-2xl hover:bg-[var(--color-navy-100)] disabled:opacity-25"
        >
          ›
        </button>
      </div>

      {total > 1 && (
        <p className="mt-2 text-center text-sm text-[var(--color-gray-400)]">
          좌우로 넘기거나 ← → 키로 페이지를 이동할 수 있습니다.
        </p>
      )}

      {/*
        WIREFRAME §14b-2 하단 안내 — "이 문구가 실제 억제력을 만든다".
        와이어프레임 원문의 "저장·캡처 없이 열람만 가능합니다"는 쓰지 않았다:
        캡처는 막을 수 없으므로 그 문장은 사실이 아니고, 사실이 아닌 안심이
        가장 위험하다 (ARCHITECTURE §7.7 "정직하게 알려야 할 것").
      */}
      <div className="mt-8 rounded-[var(--radius-card)] bg-[var(--color-navy-100)]/50 p-4 text-sm leading-relaxed">
        <p className="font-bold">
          <span aria-hidden>🔒</span> 이 페이지에는{" "}
          {`${user!.name} ${phoneTail(user!.phone)}, 열람 시각이 함께 인쇄되어 있습니다.`}
        </p>
        <p className="mt-2 text-[var(--color-gray-400)]">
          다운로드 파일은 제공되지 않지만 화면 캡처를 기술적으로 막을 방법은
          없습니다. 캡처한 이미지에도 위 정보가 그대로 남으니 자료를 외부로
          옮기지 말아 주세요. 누가 몇 페이지까지 열람했는지도 기록됩니다.
        </p>
      </div>
    </div>
  );
}
