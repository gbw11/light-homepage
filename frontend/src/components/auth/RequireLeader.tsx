"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RequireMember } from "@/components/auth/RequireMember";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import type { Role } from "@/types/api";

/** 임원(`L`) 이상인가 — SPEC_API §1.5의 계단식 권한 (`L` ⊂ `L`·`T`) */
export function isLeaderOrAbove(role: Role): boolean {
  return role === "LEADER" || role === "PASTOR";
}

/**
 * 회의록·예산안(`MINUTES`/`BUDGET`)처럼 **임원(`L`) 이상**이 필요한 화면을
 * 감싼다 (SPEC_API §3.1 · FR-DOC-03/04).
 *
 * `RequireMember`는 "승인된 회원인가"까지만 본다 — 일반 회원(`MEMBER`)도
 * 통과한다. 그래서 이 컴포넌트는 `RequireMember`를 그대로 감싸고
 * (비로그인 → `/login`, 승인 대기 → `/pending` 처리를 재사용) 역할 검사만
 * 한 겹 더 얹는다.
 *
 * 비로그인/승인대기와 달리 **일반 회원은 리다이렉트하지 않고 "권한이 없습니다"
 * 화면을 보여준다.** 정상적으로 로그인한 사용자를 말없이 다른 곳으로
 * 튕기면 "왜 안 되는지"를 알 수 없기 때문이다.
 *
 * ⚠️ 이건 UI 편의 기능이다. 실제 인가는 서버가 한다 (`RequireMember.tsx`
 * 주석 · docs/WORKPLAN.md §5.1 "메뉴를 숨겼으니 됐다고 판단하지 않는다").
 * 서버는 권한 없는 사용자에게 목록은 `FORBIDDEN`, 상세는 존재 자체를 숨기려
 * `NOT_FOUND`를 돌려준다 (SPEC_API §3.2 · §3.3).
 */
export function RequireLeader({
  children,
  /**
   * 권한이 없을 때 보여줄 한 줄 설명. 화면마다 "무엇이" 임원 전용인지가
   * 달라서(열람 vs 작성) 기본값만 두고 필요한 화면이 바꿔 쓴다.
   */
  description = "회의록·예산안은 임원 이상만 열람할 수 있습니다. 자료가 필요하시면 임원에게 문의해 주세요.",
}: {
  children: ReactNode;
  description?: string;
}) {
  return (
    <RequireMember>
      <LeaderOnly description={description}>{children}</LeaderOnly>
    </RequireMember>
  );
}

function LeaderOnly({
  children,
  description,
}: {
  children: ReactNode;
  description: string;
}) {
  const { user } = useAuth();

  // RequireMember가 비로그인/승인대기를 이미 걸러내므로 여기 도달하면 user는
  // 항상 존재한다. 타입은 여전히 nullable이라 방어적으로 처리한다.
  if (!user) return null;

  if (!isLeaderOrAbove(user.role)) return <ForbiddenState description={description} />;

  return <>{children}</>;
}

function ForbiddenState({ description }: { description: string }) {
  return (
    <Section>
      {/*
        스크린리더가 이 상태를 알아채야 한다 — 클라이언트에서 판정하므로
        페이지 로드 후에 나타난다. 제목은 h2다: 이 컴포넌트는 각 페이지의
        h1 아래에 렌더되므로 h1을 또 만들면 계층이 깨진다.
      */}
      <div
        role="alert"
        className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-8 text-center"
      >
        <h2 className="text-lg font-bold">권한이 없습니다</h2>
        <p className="mt-2 text-sm text-[var(--color-gray-400)]">{description}</p>
        <Link
          href="/my"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold transition hover:brightness-95"
        >
          나의 LIGHT로
        </Link>
      </div>
    </Section>
  );
}
