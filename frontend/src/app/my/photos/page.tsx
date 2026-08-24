import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { Section } from "@/components/ui/Section";
import { AlbumList } from "./_components/AlbumList";
import { CreateAlbumSection } from "./_components/CreateAlbumSection";

export const metadata: Metadata = {
  title: "사진첩",
  description: "LIGHT 청년교회 행사 사진첩입니다.",
};

/**
 * WIREFRAME.md §13-1 — 앨범 목록 `/my/photos`. 회원(`M`) 이상만 접근하므로
 * `RequireMember`로 감싼다 (SPEC_API §6.1).
 *
 * `/news`·`/my/notices`와 달리 서버에서 prefetch하지 않는다 — `albums.list`는
 * 세션이 필요하고(SPEC_API §6.1 권한 `M`), mock 세션은 브라우저
 * localStorage에만 존재해서 서버에서 부르면 항상 401이 캐시된다. 실제 연동
 * 시에도 인증 쿠키가 필요한 요청이라 목록은 클라이언트에서 가져온다.
 */
export default function MyPhotosPage() {
  return (
    <main>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">사진첩</h1>
        <div className="mt-8">
          <RequireMember>
            <div className="mb-8">
              <CreateAlbumSection />
            </div>
            <AlbumList />
          </RequireMember>
        </div>
      </Section>
    </main>
  );
}
