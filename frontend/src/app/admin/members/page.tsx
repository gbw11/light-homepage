import type { Metadata } from "next";
import Link from "next/link";
import { RequirePastor } from "@/components/auth/RequirePastor";
import { MemberBoard } from "./_components/MemberBoard";

export const metadata: Metadata = {
  title: "회원 관리 | LIGHT",
  // 개인정보(이름·연락처)를 다루는 화면이다. robots.ts의 `/admin` disallow ·
  // next.config.ts의 X-Robots-Tag와 삼중으로 막는다.
  robots: { index: false, follow: false },
};

/**
 * WIREFRAME.md §19 — 회원 관리 `/admin/members` (FR-ADM-02/03/04, M4).
 *
 * ⚠️ **전도사(`T`) 전용이다.** 관리 홈(`/admin`)은 임원도 들어오지만
 * §8.1~§8.4는 전부 `T`이므로 이 라우트만 `RequirePastor`로 올린다
 * (SPEC_API §8 권한 표). 임원이 들어오면 "권한이 없습니다" + 관리 홈으로
 * 돌아가는 링크를 본다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다** — 회원 이름·연락처가 초기 HTML에
 * 실려 내려가면 안 된다. 목록은 로그인한 브라우저에서만 조회한다
 * (`/my/documents`와 같은 판단).
 */
export default function AdminMembersPage() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <Link
          href="/admin"
          className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-navy-900)]"
        >
          ← 관리
        </Link>
        <h1 className="mt-2 text-2xl font-bold md:text-3xl">회원 관리</h1>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          🔒 전도사님만 이용할 수 있는 화면입니다
        </p>
      </section>

      <RequirePastor>
        <MemberBoard />
      </RequirePastor>
    </main>
  );
}
