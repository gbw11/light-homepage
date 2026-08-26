import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { AdminHome } from "./_components/AdminHome";

export const metadata: Metadata = {
  title: "관리 | LIGHT",
  // 관리 화면은 검색 결과에 나올 이유가 없다 (권한이 있어야 열리는 화면).
  // robots.ts의 `/admin` disallow · next.config.ts의 X-Robots-Tag와 삼중 방어.
  robots: { index: false, follow: false },
};

/**
 * WIREFRAME.md §15 — 관리 홈 `/admin` (FR-ADM-01, M4).
 *
 * **권한이 항목마다 다른 화면이다** (SPEC_API §8):
 * - 화면 자체 · 저장 용량(§8.5) · 새가족 내역(§8.6) → 임원(`L`) 이상
 * - 승인 대기 알림 · 회원 관리(§8.1~§8.4) → 전도사(`T`) 전용
 *
 * 그래서 페이지 게이트는 `RequireLeader`로 두고, 전도사 전용 조각만
 * 내부에서 역할을 다시 본다 (`AdminHome`). 게이트를 `RequirePastor`로
 * 올리면 임원이 저장 용량을 볼 수 없게 된다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다** — `/documents`와 같은 이유다.
 * 세션이 필요한 데이터(회원 목록·저장 용량)를 초기 HTML에 구우면 권한 없는
 * 브라우저까지 내려간다.
 */
export default function AdminHomePage() {
  return (
    <main id="main" tabIndex={-1}>
      <RequireLeader description="관리 화면은 임원 이상만 이용할 수 있습니다.">
        <AdminHome />
      </RequireLeader>
    </main>
  );
}
