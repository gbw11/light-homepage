import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { PostEditLoader } from "./_components/PostEditLoader";

export const metadata: Metadata = {
  // 관리 화면은 검색 결과에 나올 이유가 없다 (권한이 있어야 열리는 화면).
  // 제목도 정적으로 둔다 — `generateMetadata`에서 글을 조회하면 회의록·예산안
  // 제목이 권한 판단 전에 서버에서 렌더된다 (`/my/documents/[slug]`와 같은 판단).
  title: "글 수정 | LIGHT",
  robots: { index: false, follow: false },
};

/**
 * 글 수정 `/admin/posts/[id]/edit` (SPEC_API §3.5, 권한 `L`).
 *
 * 작성 화면(`/admin/posts/new`)과 **같은 폼**을 쓴다 — 요청 형태가 §3.4와
 * 동일하기 때문이다. 다른 것은 글을 먼저 불러온다는 점뿐이라 그 조회만
 * `PostEditLoader`가 맡는다.
 *
 * ⚠️ `RequireLeader`는 UI 편의다. 실제 인가는 서버가 한다 (WORKPLAN §5.1).
 */
export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <RequireLeader description="글 수정은 임원 이상만 할 수 있습니다.">
      <main id="main" tabIndex={-1}>
        <PostEditLoader id={id} />
      </main>
    </RequireLeader>
  );
}
