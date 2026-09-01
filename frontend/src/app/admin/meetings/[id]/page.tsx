import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { MeetingAdminPanel } from "./_components/MeetingAdminPanel";

export const metadata: Metadata = {
  // 제목을 정적으로 둔다 — `generateMetadata`에서 조회하면 월례회 자료 제목이
  // 권한 판단 전에 서버에서 렌더된다 (`/documents/[slug]`와 같은 판단)
  title: "월례회 자료 관리",
  robots: { index: false, follow: false },
};

/**
 * 월례회 열람 기간 수정·삭제 `/admin/meetings/[id]`
 * (SPEC_API §7.5 · §7.6 · WIREFRAME §21).
 *
 * ⚠️ `RequireLeader`는 UI 편의다. 실제 인가는 서버가 한다 (WORKPLAN §5.1).
 */
export default async function MeetingAdminPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireLeader description="월례회 자료 관리는 임원 이상만 할 수 있습니다.">
      <main id="main" tabIndex={-1}>
        <MeetingAdminPanel id={id} />
      </main>
    </RequireLeader>
  );
}
