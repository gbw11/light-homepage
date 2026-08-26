"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * `public/sw.js`를 등록한다 (FR-MEM-03).
 *
 * 렌더하는 것이 없는 부수효과 전용 컴포넌트다. 루트 레이아웃에 한 번 올린다.
 *
 * **의존성을 추가하지 않았다.** `next-pwa`류는 App Router 지원이 사실상 방치
 * 상태이고, ARCHITECTURE.md §2.1이 적어둔 Serwist도 캐싱 정책을 라이브러리
 * 설정으로 표현하게 만든다. 이 프로젝트에서 캐싱 정책은 편의 기능이 아니라
 * **보안 요구사항**(FR-MEM-03)이라, 손으로 쓴 40줄짜리 워커를 그대로 읽고
 * 감사할 수 있는 편이 낫다. `public/sw.js` 상단 주석이 그 정책 전문이다.
 *
 * ⚠️ 개발 모드에서는 등록하지 않고 오히려 **해제한다.** 정적 자산을 캐시
 *    우선으로 잡으면 HMR이 낡은 청크를 물고, 한 번 설치된 프로덕션 워커가
 *    같은 origin(localhost)의 개발 서버까지 계속 가로챈다. 그래서 SW 동작
 *    확인은 `npm run build && npm run start`로 한다.
 */
export function ServiceWorkerRegistrar() {
  const { user } = useAuth();
  const wasSignedIn = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => void registration.unregister());
      });
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js", {
        scope: "/",
        // 워커 스크립트를 HTTP 캐시에서 읽지 않는다 — 낡은 워커에 갇히지
        // 않으려면 이게 필요하다. 이 옵션 덕분에 `next.config.ts`에
        // `/sw.js` 전용 Cache-Control 헤더를 따로 넣지 않아도 된다.
        updateViaCache: "none",
      })
      .then((registration) => registration.update())
      .catch(() => {
        // 등록 실패는 기능 저하일 뿐이다 (예: HTTPS 아님, 사용자가 차단).
        // 화면에 에러를 띄우지 않는다.
      });
  }, []);

  /**
   * 로그아웃 순간 캐시를 비운다 — 방어적 조치다.
   *
   * 설계상 회원 데이터는 애초에 캐시에 들어가지 않으므로(`public/sw.js`)
   * 이건 두 번째 자물쇠다. 공용 기기를 쓰는 회원을 생각하면 "캐시에 없다고
   * 믿는다"보다 "비운다"가 맞다.
   */
  useEffect(() => {
    if (user) {
      wasSignedIn.current = true;
      return;
    }
    if (!wasSignedIn.current) return;
    wasSignedIn.current = false;
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHES" });
  }, [user]);

  return null;
}
