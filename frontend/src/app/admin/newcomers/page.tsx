import type { Metadata } from "next";
import Link from "next/link";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { NewcomerList } from "./_components/NewcomerList";

export const metadata: Metadata = {
  title: "새가족 등록 내역 | LIGHT",
  /*
   * ⚠️ 이 화면은 **개인정보**(이름·연락처·연령대)를 나열한다. 색인은
   * 삼중으로 막혀 있다: 여기 `robots` + `src/app/robots.ts`의 `/admin`
   * disallow + `next.config.ts`의 `X-Robots-Tag: noindex, nofollow`
   * (`/(my|admin)/:path*` — `/admin` 단독 경로까지 포함, 응답 헤더로 확인함).
   */
  robots: { index: false, follow: false },
};

/**
 * WIREFRAME.md §20 — 새가족 등록 내역 `/admin/newcomers` (FR-ADM-07, M4).
 *
 * 권한은 **`L` 이상**이다 (SPEC_API §8.6) — 회원 관리(`T`)와 다르다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다.** 새가족의 이름·연락처가 초기 HTML에
 * 실려 내려가면 안 된다 (`/documents`·`/admin/members`와 같은 판단).
 * 목록은 로그인한 브라우저에서만 조회한다.
 */
export default function AdminNewcomersPage() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <Link
          href="/admin"
          className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
        >
          ← 관리
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">새가족 등록 내역</h1>

        {/*
          FR-ADM-07 수용 기준 — "개인정보이므로 보유기간 1년 후 삭제 안내를
          화면에 표시한다". 안내를 목록 위에 두는 이유: 아래에 두면 개인정보를
          다 본 다음에야 읽게 된다.
        */}
        <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-red-500)] px-4 py-3 text-sm font-bold text-[var(--color-red-500)]">
          🔒 개인정보입니다. 등록일로부터 <strong>1년 후 자동 삭제</strong>되며,
          외부로 공유·복사하지 말아 주세요.
        </p>
      </section>

      <RequireLeader description="새가족 등록 내역은 임원 이상만 열람할 수 있습니다.">
        <NewcomerList />
      </RequireLeader>
    </main>
  );
}
