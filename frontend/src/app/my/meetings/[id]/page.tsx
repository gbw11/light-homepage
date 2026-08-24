import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { Section } from "@/components/ui/Section";
import { MeetingScreen } from "./_components/MeetingScreen";

/**
 * 제목에 자료 제목을 넣지 않는다 — `generateMetadata`로 제목을 가져오려면
 * 서버에서 `meetings.get`을 불러야 하고, 그건 권한 `M`(쿠키 인증)이라
 * 서버에서는 항상 401이 된다(mock 세션은 localStorage에 있다). 게다가 문서
 * 제목이 브라우저 히스토리·탭 제목에 남는 것 자체가 이 기능의 취지와 맞지
 * 않는다.
 */
export const metadata: Metadata = {
  title: "월례회 자료",
  description: "LIGHT 청년교회 월례회 자료입니다.",
};

/** WIREFRAME.md §14b-2 · FR-MTG-02 — 월례회 자료 뷰어 `/my/meetings/[id]` */
export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <RequireMember>
          <MeetingScreen meetingId={id} />
        </RequireMember>
      </Section>
    </main>
  );
}
