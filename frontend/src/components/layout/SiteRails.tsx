"use client";

import { usePathname } from "next/navigation";
import { SideRails } from "./SideRails";

/**
 * 첫 화면(`/`)에서만 양옆 바로가기를 감춘다.
 *
 * 이유는 `SiteFooter`와 같다 — `/`는 **딱 한 화면 · 하나의 클릭 대상**이어야
 * 한다 (PM 결정 2026-08-25). 화면 양옆에 버튼이 떠 있으면 누를 곳이 셋이 되어
 * 그 인상이 깨진다.
 */
export function SiteRails() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <SideRails />;
}
