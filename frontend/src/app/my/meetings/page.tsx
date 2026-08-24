import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { Section } from "@/components/ui/Section";
import { MeetingList } from "./_components/MeetingList";

export const metadata: Metadata = {
  title: "월례회 자료",
  description: "LIGHT 청년교회 월례회 자료입니다.",
};

/**
 * WIREFRAME.md §14b-1 · FR-MTG-01 — 월례회 자료 목록 `/my/meetings`.
 *
 * `/my/bulletin`과 같은 이유로 서버에서 prefetch하지 않는다: `meetings.*`는
 * 전부 권한 `M`이고(SPEC_API §7.1), mock 세션은 브라우저 localStorage에만
 * 있어서 서버에서 부르면 항상 401이 된다. 이 파일은 라우팅·권한 경계와
 * 페이지 제목만 담당한다.
 */
export default function MyMeetingsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">월례회 자료</h1>
        <div className="mt-8">
          <RequireMember>
            <MeetingList />
          </RequireMember>
        </div>
      </Section>
    </main>
  );
}
