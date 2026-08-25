"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * `M` 이상 권한이 필요한 화면을 감싼다 (SPEC_API §1.5).
 *
 * 공개 열람 전환(PM 결정 2026-08-25) 이후 열람 화면에는 쓰지 않는다 —
 * 남은 사용처는 본인 정보(`/my/profile`)처럼 **로그인한 그 사람의 데이터**를
 * 다루는 화면뿐이다. 임원·전도사 화면은 RequireLeader/RequirePastor가 맡는다.
 *
 * ⚠️ 이건 UI 편의 기능이다. 실제 인가는 서버가 한다 (docs/WORKPLAN.md §5.1
 * "메뉴를 숨겼으니 됐다고 판단하지 않는다"). 여기서는 로그인 안 된 사용자를
 * `/login`으로, 승인 대기 중인 사용자를 `/pending`으로 보내 헛걸음을
 * 줄이는 역할만 한다.
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role === "PENDING") {
      router.replace("/pending");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role === "PENDING") return null;

  return <>{children}</>;
}
