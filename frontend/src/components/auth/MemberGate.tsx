"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { Section } from "@/components/ui/Section";

/**
 * 회원 전용 **열람** 화면의 게이트 (SPEC_API §3.1·§10 v1.3 — 내부공지·회의록·
 * 사진첩·월례회가 다시 `M`이 됐다).
 *
 * `RequireMember`(본인 데이터 화면, /login으로 리다이렉트)와 달리 **그 자리에서
 * 로그인 유도 화면을 그린다** — 열람 화면은 헤더 메뉴로 들어오는 목적지라서,
 * 리다이렉트로 튕기면 방문자가 "왜 로그인 화면이 떴는지"를 모른다.
 *
 * 401/403 구분(§10 주의 3): 여기서 처리하는 것은 "로그인하면 됨"(401 계열)
 * 하나다. 로그인한 회원이 권한 미달인 경우(403 — 예산안 등)는 각 화면이
 * 서버 응답(FORBIDDEN)을 받아 "권한이 없습니다"로 따로 안내한다.
 *
 * ⚠️ UI 편의 기능이다. 실제 인가는 서버가 한다 — 이 게이트를 우회해 API를
 * 불러도 서버가 401을 준다 (mock도 같은 가드를 갖는다).
 */
export function MemberGate({
  children,
  description = "회원만 볼 수 있는 자료입니다.",
}: {
  children: ReactNode;
  description?: string;
}) {
  const { user, isLoading } = useAuth();

  // 세션 확인 중 — 로그인 유도 화면이 잠깐 떴다 사라지는 깜빡임을 막는다
  if (isLoading) return null;

  if (!user) {
    return (
      <Section className="pt-8">
        <div className="mx-auto w-full max-w-sm text-center">
          <p className="text-4xl">🔒</p>
          <h2 className="mt-4 text-xl font-bold">로그인이 필요합니다</h2>
          <p className="mt-2 leading-relaxed text-[var(--color-gray-400)]">{description}</p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)]"
          >
            로그인
          </Link>
          <Link
            href="/signup"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center text-sm text-[var(--color-gray-400)]"
          >
            ▸ 처음이신가요? 회원가입
          </Link>
        </div>
      </Section>
    );
  }

  return <>{children}</>;
}
