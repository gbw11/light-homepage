import type { Metadata } from "next";
import { Section } from "@/components/ui/Section";
import { AlbumList } from "./_components/AlbumList";
import { CreateAlbumSection } from "./_components/CreateAlbumSection";

export const metadata: Metadata = {
  title: "사진첩",
  description: "LIGHT 청년교회 행사 사진첩입니다.",
};

/**
 * WIREFRAME.md §13-1 — 앨범 목록 `/photos`.
 * 공개 열람 전환(PM 결정 2026-08-25): 열람은 로그인 없이 가능하다.
 * 앨범 생성(CreateAlbumSection)·업로드는 임원 권한으로 남는다.
 * 데이터는 기존대로 클라이언트에서 가져온다.
 */
export default function MyPhotosPage() {
  return (
    <main id="main" tabIndex={-1}>
      <Section>
        <h1 className="text-2xl font-bold md:text-3xl">사진첩</h1>
        <div className="mt-8">
          <div className="mb-8">
            <CreateAlbumSection />
          </div>
          <AlbumList />
        </div>
      </Section>
    </main>
  );
}
