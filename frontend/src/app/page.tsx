import type { Metadata } from "next";
import { LandingGate } from "./_components/LandingGate";

export const metadata: Metadata = {
  title: "LIGHT — 김해교회 청년교회",
  description:
    "청년예배 주일 14:00 드림센터 4층. 하나님 안에 살며, 이웃을 돕는 청년 공동체 LIGHT입니다.",
};

/**
 * 첫 화면 클릭 게이트 (PM 결정: docs/DECISIONS.md "첫 화면 클릭 게이트: 신규/기존 방문자 분기").
 * 기존 스크롤형 HOME(FR-PUB-01)은 /home으로 이동했다.
 * 실제 인터랙션은 클라이언트 컴포넌트(`_components/LandingGate.tsx`)로 분리한다.
 */
export default function Home() {
  return (
    <main id="main" tabIndex={-1}>
      <LandingGate />
    </main>
  );
}
