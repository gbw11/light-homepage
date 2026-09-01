import type { Metadata } from "next";
import Link from "next/link";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { SessionList } from "./_components/SessionList";

export const metadata: Metadata = {
  title: "출석부",
  /*
   * 출석 기록은 "누가 교회에 안 나왔는지"의 기록이다 — 예산안과 같은 급의
   * 민감 정보로 다룬다 (브리핑 2026-08-28 §7). 색인은 robots.ts의 `/admin`
   * disallow + next.config.ts의 X-Robots-Tag와 함께 삼중으로 막는다.
   */
  robots: { index: false, follow: false },
};

/**
 * 출석부 — 회차 목록 `/admin/attendance`.
 *
 * ⚠️ **스펙 문서에 아직 없는 신규 화면이다** (WIREFRAME.md 미반영).
 * `docs/handoff/2026-08-28-auth-roster-model.md §7` 초안과 §9-E 권장안
 * (1차 = 본인 조회 없음 + 임원은 전체)을 기준으로 만들었다 — 확정 브리핑이
 * 나오면 그때 WIREFRAME에 반영한다.
 *
 * 권한은 전부 **`L`(임원) 이상**이다 (§7 인가 매트릭스).
 *
 * ⚠️ **서버에서 prefetch하지 않는다** — `/admin/newcomers`와 같은 판단.
 * 출결은 세션이 필요한 데이터이고, 초기 HTML에 구우면 권한 없는 브라우저까지
 * 내려간다.
 */
export default function AdminAttendancePage() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <Link
          href="/admin"
          className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
        >
          ← 관리
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">출석부</h1>
        <p className="mt-2 text-base text-[var(--color-gray-400)]">
          회차를 만들고 눌러서 출결을 체크합니다. 명단 기준이라 계정이 없는
          지체도 체크할 수 있습니다.
        </p>
      </section>

      <RequireLeader description="출석부는 임원 이상만 사용할 수 있습니다.">
        <SessionList />
      </RequireLeader>
    </main>
  );
}
