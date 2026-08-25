import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { BulletinScreen } from "./_components/BulletinScreen";

export const metadata: Metadata = {
  title: "주보",
  description: "LIGHT 청년교회 주보입니다.",
};

/**
 * WIREFRAME.md §12 · FR-BUL-01~03 — 주보 `/my/bulletin`.
 *
 * 공개 열람 전환(PM 결정 2026-08-25): 열람은 로그인 없이 가능하다.
 * 업로드·삭제(BulletinAdminBar)만 임원 권한으로 남는다.
 * 데이터는 기존대로 클라이언트에서 가져온다.
 */
export default function MyBulletinPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">주보</h1>
        <div className="mt-8">
          <BulletinScreen />
        </div>
      </Section>
    </main>
  );
}
