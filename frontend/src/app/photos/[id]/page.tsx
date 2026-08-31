import type { Metadata } from "next";
import { MemberGate } from "@/components/auth/MemberGate";
import { PhotoGrid } from "./_components/PhotoGrid";

export const metadata: Metadata = {
  title: "사진첩",
  description: "LIGHT 청년교회 사진첩 앨범입니다.",
};

/**
 * WIREFRAME.md §13-2 — 앨범 상세 `/photos/[id]`.
 *
 * 열람은 회원 전용이다 (2026-08-31 — 8/25 공개 전환의 부분 철회, SPEC_API §10).
 * 사진 업로드·삭제는 임원 권한으로 남는다 (UploadLink·Lightbox ⋮).
 */
export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main id="main" tabIndex={-1}>
      <MemberGate description="행사 사진첩은 회원만 볼 수 있습니다.">
        <PhotoGrid albumId={id} />
      </MemberGate>
    </main>
  );
}
