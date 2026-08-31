import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { MemberGate } from "@/components/auth/MemberGate";
import { MeetingList } from "./_components/MeetingList";

export const metadata: Metadata = {
  title: "월례회 자료",
  description: "LIGHT 청년교회 월례회 자료입니다.",
};

/**
 * WIREFRAME.md §14b-1 · FR-MTG-01 — 월례회 자료 목록 `/meetings`.
 *
 * 목록·열람은 회원 전용이다 (2026-08-31 — 8/25 공개 전환의 부분 철회,
 * SPEC_API §10). 업로드·기간 관리·열람 로그는 임원 권한으로 남는다.
 */
export default function MyMeetingsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">월례회 자료</h1>
        <MemberGate description="월례회 자료는 회원만 볼 수 있습니다.">
          <div className="mt-8">
            <MeetingList />
          </div>
        </MemberGate>
      </Section>
    </main>
  );
}
