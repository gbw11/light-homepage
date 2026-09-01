import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { BulletinUploadForm } from "./_components/BulletinUploadForm";

export const metadata: Metadata = {
  title: "주보 업로드",
  // 관리 화면은 검색 대상이 아니다 (`/admin` 전체가 robots.ts에서 disallow).
  robots: { index: false, follow: false },
};

/**
 * WIREFRAME.md §17 — 주보 업로드 `/admin/bulletin/upload` (FR-BUL-05/06, M3).
 *
 * 권한은 임원(`L`) 이상 — `POST /api/bulletins`가 `L`이다 (SPEC_API §5.4).
 *
 * ⚠️ **사진 업로드와 전송 경로가 다르다.** 주보는 `multipart/form-data`로
 * **Spring을 통과**한다 (§5.4). presigned PUT을 쓰는 사진첩(§6.5)과 달리
 * 페이지 수가 2~4장이라 서버를 거치는 비용이 문제되지 않고, 순서가 곧
 * 페이지 번호라서 서버가 한 요청 안에서 순서를 확정하는 편이 안전하다.
 */
export default function BulletinUploadPage() {
  return (
    <main id="main" tabIndex={-1}>
      <RequireLeader description="주보 업로드는 임원 이상만 할 수 있습니다.">
        <BulletinUploadForm />
      </RequireLeader>
    </main>
  );
}
