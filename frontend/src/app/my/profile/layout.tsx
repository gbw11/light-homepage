import type { Metadata } from "next";

/**
 * `page.tsx`가 `"use client"`라서 거기서는 `metadata`를 export할 수 없다.
 * 이 라우트만 문서 제목이 기본값("LIGHT — 김해교회 청년교회")으로 남아 있어서
 * 탭·방문기록·스크린리더에서 다른 페이지와 구분되지 않았다 (WCAG 2.4.2).
 */
export const metadata: Metadata = {
  title: "내 정보",
  description: "LIGHT 회원 정보 확인 · 연락처 수정 · 비밀번호 변경.",
};

export default function ProfileLayout({ children }: LayoutProps<"/my/profile">) {
  return children;
}
