import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { MeetingList } from "./_components/MeetingList";

export const metadata: Metadata = {
  title: "월례회 자료",
  description: "LIGHT 청년교회 월례회 자료입니다.",
};

/**
 * WIREFRAME.md §14b-1 · FR-MTG-01 — 월례회 자료 목록 `/meetings`.
 *
 * 공개 열람 전환(PM 결정 2026-08-25): 목록·열람은 로그인 없이 가능하다.
 * 업로드·기간 관리·열람 로그는 임원 권한으로 남는다 (/admin/meetings/**).
 * 데이터는 기존대로 클라이언트에서 가져온다.
 */
export default function MyMeetingsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">월례회 자료</h1>
        <div className="mt-8">
          <MeetingList />
        </div>
      </Section>
    </main>
  );
}
