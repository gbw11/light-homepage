import type { Metadata } from "next";
import { MemberGate } from "@/components/auth/MemberGate";
import { Section } from "@/components/ui/Section";
import { BulletinScreen } from "./_components/BulletinScreen";

export const metadata: Metadata = {
  title: "주보",
  description: "LIGHT 청년교회 주보입니다.",
};

/**
 * WIREFRAME.md §12 · FR-BUL-01~03 — 주보 `/bulletin`.
 *
 * ⚠️ **열람은 회원(`M`)부터다** (BE 전달 2026-09-04 — 2026-08-25의 공개 열람
 * 전환 결정을 대체한다). 서버가 비로그인에 401을 준다.
 *
 * 막힘이 401이라 `MemberGate`를 쓴다 — 주보가 있다는 사실 자체는 비밀이
 * 아니고 "로그인하면 볼 수 있습니다"로 안내하면 된다. 예산안의 403·404와
 * 다르다 (SPEC_API §10 주의 3).
 *
 * 제목은 게이트 **밖**에 둔다 (`/documents`와 같은 구성) — 게이트 안에 넣으면
 * 로그인 유도 화면에 무슨 화면인지가 안 남는다.
 *
 * 업로드·삭제(BulletinAdminBar)는 그대로 임원 권한이다.
 * 데이터는 기존대로 클라이언트에서 가져온다.
 */
export default function MyBulletinPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">주보</h1>
      </Section>

      <MemberGate description="주보는 회원만 볼 수 있습니다.">
        <Section className="pt-8">
          <BulletinScreen />
        </Section>
      </MemberGate>
    </main>
  );
}
