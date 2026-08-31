"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * `M` 이상 권한이 필요한 화면을 감싼다 (SPEC_API §1.5).
 *
 * 본인 정보(`/my/profile`)처럼 **로그인한 그 사람의 데이터**를 다루는 화면에
 * 쓴다. 임원·전도사 화면은 RequireLeader/RequirePastor가 맡는다.
 * (회원 전용 열람 화면의 401/403 분기는 PR-5에서 별도 게이트로 만든다)
 *
 * ⚠️ 이건 UI 편의 기능이다. 실제 인가는 서버가 한다 (docs/spec/WORKPLAN.md §5.1
 * "메뉴를 숨겼으니 됐다고 판단하지 않는다"). 여기서는 로그인 안 된 사용자를
 * `/login`으로 보내 헛걸음을 줄이는 역할만 한다.
 * (~~PENDING → /pending~~ 은 2026-08-31 승인 폐지로 소멸 — SPEC_API §2 v1.3)
 */
export function RequireMember({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) return null;

  return <>{children}</>;
}
