"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * `[ 홈 화면에 추가 ]` 설치 배너 — WIREFRAME.md §11 · FR-MEM-03 · NFR-COMP-06.
 *
 * "회원 첫 방문 시 설치 배너 **1회** 노출" (SPEC_FUNCTIONAL.md FR-MEM-03).
 * 그래서 한 번 띄운 시점에 localStorage에 기록하고 다시 띄우지 않는다. 닫기를
 * 눌렀는지와 무관하게 노출 자체가 1회다 — 조를 이유가 없다.
 *
 * ⚠️ 이 컴포넌트는 루트 레이아웃에서 마운트되고, **자기 스스로 `/my`에서만**
 *    렌더한다. 와이어프레임상 자리는 `/my` 홈이지만 `src/app/my/**`는 다른
 *    작업자가 소유한 파일이라 그쪽을 건드리지 않기 위한 선택이다. 정확히
 *    `/my`에서만 렌더해서 하위 화면(주보 뷰어·사진 라이트박스)을 덮지 않는다.
 *
 * 브라우저별 동작 (NFR-COMP-06 "Android ○ / iOS ○(공유 → 홈 화면 추가, 안내 필요)"):
 *   · Android Chrome 등 → `beforeinstallprompt`를 잡아 실제 설치 프롬프트 버튼
 *   · iOS Safari → 이 이벤트가 없다. 공유 시트 안내 문구만 보여준다
 *   · 카카오톡·페이스북 등 인앱 브라우저 → 홈 화면 추가가 불가능하므로 아무것도
 *     띄우지 않는다. NFR-COMP-03대로 링크 유입의 주 경로인데, 여기서 되지도
 *     않는 안내를 하면 안 된다
 *   · 그 외(데스크톱 Safari 등) → 조용히 아무것도 하지 않는다
 */

const SHOWN_KEY = "light-pwa-install-shown";

/** `beforeinstallprompt`는 표준 lib.dom에 없다 — `any` 없이 쓰려면 직접 좁힌다 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Variant = "prompt" | "ios";
type Decision = Variant | "none";

// ── beforeinstallprompt 외부 스토어 ──────────────────────────
//
// 모듈 로드 시점에 바로 구독한다. `useEffect`에서 붙이면 늦다 — 이 이벤트는
// 페이지 로드 직후 딱 한 번 오고, 놓치면 설치 프롬프트를 다시 얻을 방법이 없다.

let capturedPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // 브라우저 기본 미니 인포바를 막고 우리 배너로 대신한다
    event.preventDefault();
    capturedPrompt = event as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    capturedPrompt = null;
    window.localStorage.setItem(SHOWN_KEY, "1");
    notify();
  });
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

/** 스냅샷은 원시값이라 참조가 안정적이다 (useSyncExternalStore 요구사항) */
function getSnapshot(): boolean {
  return capturedPrompt !== null && !installed;
}

function getServerSnapshot(): boolean {
  return false;
}

// ── 노출 여부 판정 ───────────────────────────────────────────

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari 전용 비표준 플래그. 표준 Navigator 타입에 없어서 좁혀 쓴다
  // (CONVENTIONS.md §7 `any` 금지)
  const nav: Navigator & { standalone?: boolean } = window.navigator;
  return nav.standalone === true;
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua);
  const isInApp = /KAKAOTALK|FBAN|FBAV|Instagram|Line|NAVER|DaumApps/i.test(ua);
  return isIos && !isInApp;
}

/**
 * 이 세션의 결정을 모듈 스코프에 한 번만 고정한다.
 *
 * 왜 고정하는가: "노출했다"를 localStorage에 적는 순간 다음 렌더에서 판정이
 * 뒤집혀 배너가 깜빡 사라진다. 결정을 얼려두면 이번 세션에는 계속 보이고,
 * 다음 방문에는 localStorage 때문에 안 보인다 — 그게 "1회 노출"이다.
 *
 * "아직 결정하지 않음"(`null`)과 "안 띄움"(`"none"`)을 구분한다. `beforeinstallprompt`가
 * 늦게 올 수 있으므로, 아직 프롬프트가 없다고 곧바로 `"none"`으로 굳히면 안 된다.
 */
let decided: Decision | null = null;

function decide(hasPrompt: boolean): Decision {
  if (decided) return decided;
  if (isStandalone() || window.localStorage.getItem(SHOWN_KEY)) {
    decided = "none";
    return decided;
  }
  if (hasPrompt) {
    decided = "prompt";
    return decided;
  }
  if (isIosSafari()) {
    decided = "ios";
    return decided;
  }
  return "none"; // 굳히지 않는다 — 프롬프트 이벤트가 아직 올 수 있다
}

export function InstallBanner() {
  const { user } = useAuth();
  const pathname = usePathname();
  const hasPrompt = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [closed, setClosed] = useState(false);

  const onMemberHome = pathname === "/my" && user !== null;

  /**
   * 판정을 렌더 중에 한다. localStorage·matchMedia는 클라이언트 전용이지만
   * 하이드레이션 불일치가 없다 — `onMemberHome`은 `user`가 필요하고 `user`는
   * 클라이언트 페칭(AuthProvider)으로만 채워지므로, 서버 렌더와 첫 하이드레이션
   * 렌더에서는 양쪽 모두 `null`을 반환한다.
   */
  const variant: Decision = onMemberHome ? decide(hasPrompt) : "none";
  const visible = variant !== "none" && !closed;

  /** "1회 노출" 기록. 렌더 결과에 영향을 주지 않으므로 부수효과로 둔다 */
  useEffect(() => {
    if (visible) window.localStorage.setItem(SHOWN_KEY, "1");
  }, [visible]);

  const close = useCallback(() => setClosed(true), []);

  const install = useCallback(async () => {
    setClosed(true);
    await capturedPrompt?.prompt();
  }, []);

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="홈 화면에 추가 안내"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-navy-100)] bg-[var(--background)] px-5 py-4 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto flex max-w-[var(--container-max)] items-center gap-3">
        <p className="flex-1 text-sm leading-relaxed">
          {variant === "prompt" ? (
            "홈 화면에 추가하면 앱처럼 바로 열 수 있습니다."
          ) : (
            <>
              공유 버튼 <span aria-hidden="true">⎋</span> 을 누르고{" "}
              <b>홈 화면에 추가</b>를 선택하면 앱처럼 쓸 수 있습니다.
            </>
          )}
        </p>

        {variant === "prompt" && (
          <button
            type="button"
            onClick={install}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-4 text-sm font-bold text-[var(--color-navy-900)] transition hover:brightness-95"
          >
            홈 화면에 추가
          </button>
        )}

        <button
          type="button"
          onClick={close}
          aria-label="설치 안내 닫기"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-xl text-[var(--color-gray-400)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
