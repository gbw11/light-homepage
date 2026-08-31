import type { Metadata } from "next";
import Link from "next/link";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { AttendanceSheet } from "./_components/AttendanceSheet";

export const metadata: Metadata = {
  title: "출석 체크 | LIGHT",
  // 출석 기록은 민감 정보 — 목록 페이지와 같은 삼중 색인 차단
  robots: { index: false, follow: false },
};

/**
 * 출석 체크 `/admin/attendance/[id]` — 회차 하나의 명단 전원 출결.
 *
 * 브리핑 2026-08-28 §7 (`GET /attendance/sessions/{id}` ·
 * `PUT .../entries`) 초안 기준. 권한 `L` 이상.
 *
 * ⚠️ 서버에서 prefetch하지 않는다 — 명단 전원의 이름이 초기 HTML에 실리면
 * 안 된다 (목록 페이지와 같은 판단).
 */
export default async function AttendanceSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <Link
          href="/admin/attendance"
          className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
        >
          ← 출석부
        </Link>
      </section>

      <RequireLeader description="출석부는 임원 이상만 사용할 수 있습니다.">
        <AttendanceSheet sessionId={id} />
      </RequireLeader>
    </main>
  );
}
