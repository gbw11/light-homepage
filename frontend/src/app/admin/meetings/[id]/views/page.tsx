import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { MeetingViewLog } from "./_components/MeetingViewLog";

export const metadata: Metadata = {
  title: "월례회 열람 기록",
  robots: { index: false, follow: false },
};

/**
 * 월례회 열람 기록 `/admin/meetings/[id]/views`
 * (SPEC_API §7.7 · WIREFRAME §21-2).
 *
 * ⚠️ 회원 개인정보(누가·언제·어디까지 봤는지)를 모아 보여주는 화면이라
 * **서버에서 미리 가져오지 않는다** — 세션이 없어 실패하고, 성공하면 그
 * 명단이 정적 HTML에 구워진다 (docs/records/DECISIONS.md 2026-08-24).
 * 인가는 서버가 최종 판단한다 (WORKPLAN §5.1).
 */
export default async function MeetingViewsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireLeader description="열람 기록은 임원 이상만 볼 수 있습니다.">
      <main id="main" tabIndex={-1}>
        <MeetingViewLog id={id} />
      </main>
    </RequireLeader>
  );
}
