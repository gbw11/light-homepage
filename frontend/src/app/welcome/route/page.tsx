import type { Metadata } from "next";
import { RouteSlideshow } from "./_components/RouteSlideshow";

export const metadata: Metadata = {
  title: "오는 길 미리보기",
  description: "본당에서 드림센터까지, 시간순 캡처로 보는 오는 길 미리보기.",
};

/**
 * PM 요청(2026-09-15) — 본당 → 드림센터 오는 길을 이미지 시퀀스로 보여주는
 * 미리보기 페이지. `/welcome`·`/location`의 확정 콘텐츠(`RouteMap`·
 * `BuildingSketch` 손그림 SVG)와는 별개다 — 저 둘은 라이선스 문제로 로드뷰
 * 캡처를 반려하고 그림으로 대체한 확정 결정(`DECISIONS.md` 2026-09-04)이고,
 * 이 페이지는 그 결정을 임시로 뒤집은 별도 실험이다(`DECISIONS.md`
 * 2026-09-15). 그래서 기존 두 페이지를 고치지 않고 새 라우트로 뗐다.
 *
 * 여기 쓰는 로드뷰 캡처 4장은 `frontend/mock-assets/`에 있다 — `public/`이
 * 아니라 `/mock-assets/*` route handler(개발 환경에서만 응답, `NODE_ENV`
 * 게이트)를 통해서만 나간다. 즉 **배포된 사이트에서는 이 페이지의 로드뷰
 * 이미지가 보이지 않는다** — 실사진 없이는 배포에 노출하지 않는다는 원칙을
 * 우회하지 않으면서 PM이 로컬에서 미리 볼 수 있게 하는 절충이다.
 */
export default function WelcomeRoutePreviewPage() {
  return (
    <main id="main" tabIndex={-1}>
      <RouteSlideshow />
    </main>
  );
}
