"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

/**
 * 첫 화면(`/`)에서만 푸터를 감춘다.
 *
 * `/`는 **딱 한 화면**이어야 한다 (PM 결정 2026-08-25). 푸터가 붙어 있으면
 * 그만큼 문서가 길어져 휠이 먹고, "스크롤할 게 있나?" 하고 내려보게 된다 —
 * 첫 화면이 하나의 클릭 대상이라는 인상이 깨진다.
 *
 * 스크롤을 JS로 가로막지 않고 **문서를 뷰포트에 딱 맞춰** 없앤 이유:
 * 휠 이벤트를 `preventDefault`로 잡으면 키보드 `Page Down`·스페이스·모바일
 * 터치 스크롤은 그대로 남아 수단마다 동작이 갈린다. 스크롤할 것이 없으면
 * 모든 입력 수단에서 똑같이 아무 일도 일어나지 않는다.
 *
 * 주소·연락처·SNS는 `/home` 이하 모든 페이지에 그대로 있다.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return <Footer />;
}
