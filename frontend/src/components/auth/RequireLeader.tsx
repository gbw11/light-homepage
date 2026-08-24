"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * `/admin/**` 처럼 권한 `L`(임원) 이상이 필요한 화면을 감싼다 (SPEC_API §1.5).
 *
 * ⚠️ `RequireMember`와 같은 원칙 — **이건 UI 편의 기능이다. 실제 인가는 서버가
 *    한다** (docs/WORKPLAN.md §5.1 "메뉴를 숨겼으니 됐다고 판단하지 않는다").
 *    여기서는 권한 없는 사람이 빈 폼을 채우고 저장 버튼을 눌러서야 403을
 *    보는 헛걸음을 막는 역할만 한다. 서버는 `POST /api/posts`에서 다시 막는다.
 *
 * 로그인 안 됨 → `/login`, 승인 대기 → `/pending`, 권한 부족 → `/my`
 * (회원에게는 `/my`가 홈이다).
 */
export function RequireLeader({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const isLeader = user?.role === "LEADER" || user?.role === "PASTOR";

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "PENDING") {
      router.replace("/pending");
      return;
    }
    if (!isLeader) {
      router.replace("/my");
    }
  }, [user, isLoading, isLeader, router]);

  if (isLoading || !isLeader) return null;

  return <>{children}</>;
}
