"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * 공개 화면 안의 **회원 전용 화면 진입점** — 로그인한 사람에게만 그린다.
 *
 * 링크를 그대로 두면 비로그인 방문자는 **눌러야 회원 전용이라는 것을 안다.**
 * 홈은 닫힌 문을 먼저 보여주지 않는다 (PM 결정 2026-09-04, 주보). `navigation.ts`가
 * 공개 메뉴와 자료 메뉴의 줄을 나눠 둔 것과 같은 이유다.
 *
 * 쓰는 곳: 홈 "이번 주"의 주보(2026-09-04), 홈 "함께한 순간들"의 사진첩과
 * `/news`의 갤러리 탭(사진첩 열람 `M` 복귀 2026-08-31 — 점검 🟠-1).
 *
 * 공개 화면은 서버 컴포넌트라 역할을 볼 수 없어 이 조각만 클라이언트로 뗐다
 * (`EditPostLink`와 같은 방식) — 페이지 전체를 클라이언트로 바꾸면 공개 화면의
 * SSR/SEO를 잃는다.
 *
 * ⚠️ 링크를 감추는 것은 **보안이 아니라 편의**다. URL을 직접 쳐도 화면의
 * `MemberGate`가 안내하고, 최종 판단은 서버가 한다 (비로그인 401).
 */
export function MembersOnlyLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();

  // 로딩 중에도 그리지 않는다 — 링크가 떴다 사라지면 눈에 거슬린다
  if (!user) return null;

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
