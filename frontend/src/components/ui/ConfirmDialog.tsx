"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * 되돌릴 수 없는 동작을 되묻는 공용 확인 창.
 *
 * ## 왜 `window.confirm`을 걷어냈나
 *
 * 앱 전체 8곳이 네이티브 `confirm()`을 쓰고 있었다. 문구는 각각 잘 쓰여
 * 있었지만 창 자체에 세 가지 문제가 있다:
 *
 * 1. **스타일이 먹지 않는다.** 위험한 동작인데 "삭제"와 "취소"가 같은 무게로
 *    그려지고, 브라우저마다 버튼 순서가 다르다
 * 2. **모바일에서 도메인이 먼저 뜬다.** `light-homepage-....vercel.app 내용:`이
 *    첫 줄을 차지해 정작 읽어야 할 문장이 밀린다
 * 3. **기본 포커스가 확인 쪽인 브라우저가 있다.** 반사적인 Enter가 곧 삭제다
 *
 * ## 규칙
 *
 * · **초기 포커스는 취소**다 (`PhotoDeletePanel`과 같은 판단 — 무심코 누른
 *   Enter가 삭제가 아니라 취소가 되게 한다)
 * · 포커스 트랩·Escape는 `Lightbox`·`Header` 메뉴와 같은 패턴을 쓴다
 *   (NFR-A11Y-06 / -09). 같은 동작이 화면마다 다르게 느껴지지 않게 한다
 * · 열려 있는 동안 배경 스크롤을 막는다
 *
 * ## 무게는 여전히 호출부가 정한다
 *
 * 이 창은 `confirm()`을 **대체할 뿐 강도를 바꾸지 않는다.** 앨범 삭제·회원
 * 탈퇴처럼 "제목 타이핑 + 확인"을 요구하던 곳은 그 앞 단계를 그대로 둔다
 * (`AlbumDangerZone` §주석의 판단을 유지).
 */
export type ConfirmOptions = {
  /** 한 줄 제목 — 무엇을 하려는지 */
  title: string;
  /** 본문. `\n`은 줄바꿈으로 그린다 (기존 confirm 문구를 그대로 옮기기 위함) */
  description?: string;
  /** 확인 버튼 문구 (기본 "확인") */
  confirmLabel?: string;
  /** 취소 버튼 문구 (기본 "취소") */
  cancelLabel?: string;
  /**
   * `danger`면 확인 버튼이 빨강이다. 되돌릴 수 없는 동작의 기본값이므로
   * 명시하지 않으면 `danger`로 친다 — 이 컴포넌트를 쓰는 자리가 곧 그런 자리다.
   */
  tone?: "danger" | "default";
};

const DIALOG_TITLE_ID = "confirm-dialog-title";
const DIALOG_DESC_ID = "confirm-dialog-description";

function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const {
    title,
    description,
    confirmLabel = "확인",
    cancelLabel = "취소",
    tone = "danger",
  } = options;

  useEffect(() => {
    // 초기 포커스는 취소 — 반사적인 Enter가 삭제가 되지 않게 한다
    cancelRef.current?.focus();

    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5"
      // 배경 클릭으로 닫는 것은 취소다 — 확인이 되면 안 된다
      onClick={onCancel}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={DIALOG_TITLE_ID}
        aria-describedby={description ? DIALOG_DESC_ID : undefined}
        className="w-full max-w-sm rounded-[var(--radius-card)] bg-[var(--background)] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={DIALOG_TITLE_ID} className="text-lg font-bold">
          {title}
        </h2>
        {description && (
          <p
            id={DIALOG_DESC_ID}
            className="mt-3 whitespace-pre-line leading-relaxed text-[var(--color-gray-400)]"
          >
            {description}
          </p>
        )}
        <div className="mt-6 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-base font-bold"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={
              tone === "danger"
                ? "min-h-11 flex-1 rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-4 text-base font-bold text-[var(--color-danger-fg)] transition hover:brightness-95"
                : "min-h-11 flex-1 rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-4 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * `window.confirm`과 같은 모양으로 쓴다 — 호출부는 `await`만 붙이면 된다.
 *
 * ```
 * const [confirm, confirmDialog] = useConfirm();
 *
 * const ok = await confirm({ title: "삭제할까요?", description: "되돌릴 수 없습니다." });
 * if (!ok) return;
 *
 * // 화면 어딘가에 confirmDialog를 그린다 (열려 있을 때만 렌더된다)
 * ```
 *
 * 선언형 컴포넌트를 직접 두지 않고 훅으로 감싼 이유: 기존 8개 호출부가 전부
 * `const ok = window.confirm(...); if (!ok) return;` 형태라, 이 모양을 지키면
 * **판단 흐름을 건드리지 않고** 창만 바꿀 수 있다.
 */
export function useConfirm(): [(options: ConfirmOptions) => Promise<boolean>, ReactNode] {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // resolve를 state에 두면 정리(settle)를 state 업데이터 안에서 해야 하는데,
  // 업데이터는 순수해야 한다 (StrictMode에서 두 번 불린다). ref로 분리한다.
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // 앞선 확인 창이 아직 떠 있으면 취소로 정리한다 — 약속을 매달아두지 않는다
        resolveRef.current?.(false);
        resolveRef.current = resolve;
        setOptions(next);
      }),
    [],
  );

  const settle = useCallback((value: boolean) => {
    const resolve = resolveRef.current;
    resolveRef.current = null;
    setOptions(null);
    resolve?.(value);
  }, []);

  const handleConfirm = useCallback(() => settle(true), [settle]);
  const handleCancel = useCallback(() => settle(false), [settle]);

  const dialog = options ? (
    <ConfirmDialog options={options} onConfirm={handleConfirm} onCancel={handleCancel} />
  ) : null;

  return [confirm, dialog];
}
