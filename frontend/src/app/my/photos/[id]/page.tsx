import type { Metadata } from "next";
import { PhotoGrid } from "./_components/PhotoGrid";

export const metadata: Metadata = {
  title: "사진첩",
  description: "LIGHT 청년교회 사진첩 앨범입니다.",
};

/**
 * WIREFRAME.md §13-2 — 앨범 상세 `/my/photos/[id]`.
 *
 * 공개 열람 전환(PM 결정 2026-08-25): 열람은 로그인 없이 가능하다.
 * 사진 업로드·삭제는 임원 권한으로 남는다 (UploadLink·Lightbox ⋮).
 * 데이터 조회는 기존대로 클라이언트(`PhotoGrid`)에서 한다.
 */
export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main id="main" tabIndex={-1}>
      <PhotoGrid albumId={id} />
    </main>
  );
}
