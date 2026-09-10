import type { Metadata } from "next";
import { YOUTH_SERVICE_LINE_PLAIN } from "@/content/worship";
import { IntroGate } from "./_components/IntroGate";

export const metadata: Metadata = {
  title: "LIGHT — 김해교회 청년교회",
  description:
    `청년예배 ${YOUTH_SERVICE_LINE_PLAIN}. 하나님 안에 살며, 이웃을 돕는 청년 공동체 LIGHT입니다.`,
};

/**
 * 첫 화면 `/` — "LIGHT" 글자가 펼쳐지는 애니메이션(1번째 조작) 다음,
 * `/home`으로 들어간다(2번째 조작) (PM 요청 2026-09-10).
 *
 * 원래 여기 있던 전체화면 사진 게이트는 `/about`의 정적 히어로로 옮겼다.
 * 이 경로에서는 푸터를 렌더하지 않아(`SiteFooter`) 문서가 뷰포트와 정확히
 * 같아지고, 그 결과 스크롤할 것이 없다 — 대신 휠 이벤트 자체를 조작
 * 신호로 받는다. 실제 인터랙션은 클라이언트 컴포넌트
 * (`_components/IntroGate.tsx`)에 있다.
 */
export default function Home() {
  return (
    <main id="main" tabIndex={-1}>
      <IntroGate />
    </main>
  );
}
