import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { MemberGate } from "@/components/auth/MemberGate";
import { AlbumList } from "./_components/AlbumList";
import { CreateAlbumSection } from "./_components/CreateAlbumSection";

export const metadata: Metadata = {
  title: "사진첩",
  description: "LIGHT 청년교회 행사 사진첩입니다.",
};

/**
 * WIREFRAME.md §13-1 — 앨범 목록 `/photos`.
 * 열람은 회원 전용이다 (2026-08-31 — 8/25 공개 전환의 부분 철회, SPEC_API §10).
 * 앨범 생성(CreateAlbumSection)·업로드는 임원 권한으로 남는다.
 */
export default function MyPhotosPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">사진첩</h1>
        <MemberGate description="행사 사진첩은 회원만 볼 수 있습니다.">
          <div className="mt-8">
            <div className="mb-8">
              <CreateAlbumSection />
            </div>
            <AlbumList />
          </div>
        </MemberGate>
      </Section>
    </main>
  );
}
