import type { Metadata } from "next";
import { YOUTH_SERVICE_LINE_PLAIN } from "@/content/worship";
import { LandingGate } from "./_components/LandingGate";

export const metadata: Metadata = {
  title: "LIGHT — 김해교회 청년교회",
  description:
    `청년예배 ${YOUTH_SERVICE_LINE_PLAIN}. 하나님 안에 살며, 이웃을 돕는 청년 공동체 LIGHT입니다.`,
};

/**
 * 첫 화면 `/` — 화면 전체가 `/home`으로 들어가는 하나의 진입 버튼이다
 * (PM 결정 2026-08-25). 스크롤형 HOME(FR-PUB-01)은 `/home`에 있다.
 *
 * 이 경로에서는 푸터를 렌더하지 않아(`SiteFooter`) 문서가 뷰포트와 정확히
 * 같아지고, 그 결과 스크롤할 것이 없다.
 * 실제 인터랙션은 클라이언트 컴포넌트(`_components/LandingGate.tsx`)에 있다.
 */
export default function Home() {
  return (
    <main id="main" tabIndex={-1}>
      <LandingGate />
    </main>
  );
}
