"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * WIREFRAME.md §15 "⚠️ 승인 대기 2명 (PASTOR만)" — FR-ADM-01.
 *
 * ⚠️ **전도사(`T`)에게만 렌더해야 한다.** 승인 대기 수를 세려면 §8.1
 * `GET /api/admin/members`가 필요하고 그건 `T` 전용이다 — 임원에게 렌더하면
 * 화면에 의미 없는 `FORBIDDEN` 에러가 뜬다. 호출하는 쪽(`AdminHome`)이
 * 역할을 보고 이 컴포넌트를 마운트할지 결정한다.
 *
 * 에러는 조용히 삼킨다: 이건 알림 배너일 뿐이라, 못 세웠다고 관리 홈 전체를
 * 에러 화면으로 만들 이유가 없다. 회원 관리 화면에서 다시 확인할 수 있다.
 */
export function PendingApprovalBanner() {
  const { data } = useQuery({
    queryKey: ["admin", "members", "PENDING", ""],
    queryFn: () => api.admin.members({ status: "PENDING" }),
  });

  const count = data?.items.length ?? 0;
  if (count === 0) return null;

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-red-500)] p-5">
      <p className="font-bold text-[var(--color-red-500)]">
        ⚠️ 승인 대기 {count}명
      </p>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        승인 전에는 회원 영역을 이용할 수 없습니다.
      </p>
      <Link
        href="/admin/members"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
      >
        확인하기
      </Link>
    </div>
  );
}
