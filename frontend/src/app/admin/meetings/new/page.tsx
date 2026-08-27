import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { MeetingUploadForm } from "./_components/MeetingUploadForm";

export const metadata: Metadata = {
  title: "월례회 자료 업로드 | LIGHT",
  robots: { index: false, follow: false },
};

/**
 * 월례회 자료 업로드 `/admin/meetings/new` (SPEC_API §7.4 · WIREFRAME §21).
 *
 * ⚠️ `RequireLeader`는 UI 편의다. 실제 인가는 서버가 한다 (WORKPLAN §5.1).
 */
export default function NewMeetingPage() {
  return (
    <RequireLeader description="월례회 자료 업로드는 임원 이상만 할 수 있습니다.">
      <main id="main" tabIndex={-1}>
        <MeetingUploadForm />
      </main>
    </RequireLeader>
  );
}
