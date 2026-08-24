import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { PhotoGrid } from "./_components/PhotoGrid";

export const metadata: Metadata = {
  title: "사진첩",
  description: "LIGHT 청년교회 사진첩 앨범입니다.",
};

/**
 * WIREFRAME.md §13-2 — 앨범 상세 `/my/photos/[id]`.
 *
 * 서버에서 prefetch하지 않는다: mock 세션은 브라우저 localStorage에 있고
 * (`mock.ts`의 `requireSession`), 실서비스에서도 `GET /api/albums/{id}/photos`는
 * 권한 `M`(쿠키 인증)이 필요하다 (SPEC_API §6.4). 따라서 데이터 조회는 전부
 * 클라이언트(`PhotoGrid`)에서 하고, 이 페이지는 라우팅·권한 경계만 잡는다.
 */
export default async function AlbumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireMember>
      <main>
        <PhotoGrid albumId={id} />
      </main>
    </RequireMember>
  );
}
