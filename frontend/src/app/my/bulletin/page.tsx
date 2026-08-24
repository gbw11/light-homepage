import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { Section } from "@/components/ui/Section";
import { BulletinScreen } from "./_components/BulletinScreen";

export const metadata: Metadata = {
  title: "주보",
  description: "LIGHT 청년교회 주보입니다.",
};

/**
 * WIREFRAME.md §12 · FR-BUL-01~03 — 주보 `/my/bulletin`.
 *
 * `/my/photos`와 같은 이유로 서버에서 prefetch하지 않는다: `bulletins.*`는
 * 전부 권한 `M`이고(SPEC_API §5.1~5.3), mock 세션은 브라우저 localStorage에만
 * 있어서 서버에서 부르면 항상 401이 된다. 이 파일은 라우팅·권한 경계와
 * 페이지 제목만 담당하고, 데이터는 전부 클라이언트에서 가져온다.
 */
export default function MyBulletinPage() {
  return (
    <main>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">주보</h1>
        <div className="mt-8">
          <RequireMember>
            <BulletinScreen />
          </RequireMember>
        </div>
      </Section>
    </main>
  );
}
