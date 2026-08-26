import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { PhotoUploader } from "./_components/PhotoUploader";

export const metadata: Metadata = {
  title: "사진 업로드 | LIGHT",
  // 관리 화면은 검색 대상이 아니다 (`/admin` 전체가 robots.ts에서 disallow).
  robots: { index: false, follow: false },
};

/**
 * WIREFRAME.md §18 — 사진 업로드 `/admin/albums/[id]/upload` (FR-PHO-08, M3).
 *
 * 권한은 임원(`L`) 이상이다 — `POST /api/uploads:issue`가 `L`이기 때문이다
 * (SPEC_API §6.5 · §10 인가 매트릭스). 일반 회원(`M`)은 앨범을 볼 수는 있어도
 * 올릴 수는 없다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다** — 앨범 메타 조회에 세션이 필요하고,
 * 업로드 자체가 브라우저 전용 작업(Canvas 리사이즈 · R2 직접 PUT)이다
 * (ARCHITECTURE.md §7.3).
 */
export default async function PhotoUploadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main id="main" tabIndex={-1}>
      <RequireLeader description="사진 업로드는 임원 이상만 할 수 있습니다.">
        <PhotoUploader albumId={id} />
      </RequireLeader>
    </main>
  );
}
