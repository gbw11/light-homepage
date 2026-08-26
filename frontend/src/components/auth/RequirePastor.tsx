"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { RequireMember } from "@/components/auth/RequireMember";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";
import type { Role } from "@/types/api";

/** 전도사(`T`)인가 — 계단식 권한의 최상단이라 상위가 없다 (SPEC_API §1.5) */
export function isPastor(role: Role): boolean {
  return role === "PASTOR";
}

/**
 * 회원 관리(`/admin/members`)처럼 **전도사(`T`) 전용**인 화면을 감싼다
 * (SPEC_API §8.1~§8.4 · FR-ADM-02/03/04).
 *
 * `RequireLeader`와 구조가 같다 — `RequireMember`를 감싸서 비로그인(`/login`)·
 * 승인 대기(`/pending`) 처리를 재사용하고, 역할 검사만 한 겹 더 얹는다.
 * 다른 점은 **임원(`LEADER`)도 막는다**는 것뿐이다: 관리 홈(§8.5 저장 용량,
 * §8.6 새가족 내역)은 `L` 이상이지만 회원 승인·역할 부여는 `T`만이다.
 *
 * 임원도 리다이렉트하지 않고 "권한이 없습니다" 화면을 보여준다 —
 * 관리 홈까지는 들어올 수 있는 사용자가 말없이 튕기면 "왜 안 되는지"를
 * 알 수 없기 때문이다 (`RequireLeader`와 동일한 판단).
 *
 * ⚠️ 이건 UI 편의 기능이다. 실제 인가는 서버가 한다 (`RequireMember.tsx`
 * 주석 · docs/WORKPLAN.md §5.1 "메뉴를 숨겼으니 됐다고 판단하지 않는다").
 * 서버는 §8.1~§8.4에 대해 `T`가 아닌 사용자에게 `FORBIDDEN`을 돌려주므로,
 * 이 게이트를 우회해도 데이터는 나오지 않는다.
 */
export function RequirePastor({
  children,
  /**
   * 권한이 없을 때 보여줄 한 줄 설명. 화면마다 "무엇이" 전도사 전용인지가
   * 달라서 기본값만 두고 필요한 화면이 바꿔 쓴다 (`RequireLeader`와 동일).
   */
  description = "회원 승인·역할 변경은 전도사님만 할 수 있습니다.",
}: {
  children: ReactNode;
  description?: string;
}) {
  return (
    <RequireMember>
      <PastorOnly description={description}>{children}</PastorOnly>
    </RequireMember>
  );
}

function PastorOnly({
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

  if (!isPastor(user.role)) return <ForbiddenState description={description} />;

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
          href="/admin"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-6 text-base font-bold transition hover:brightness-95"
        >
          관리 홈으로
        </Link>
      </div>
    </Section>
  );
}
