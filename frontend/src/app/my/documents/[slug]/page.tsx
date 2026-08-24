import type { Metadata } from "next";
import { RequireLeader } from "@/components/auth/RequireLeader";
import { DocumentDetail } from "../_components/DocumentDetail";

/**
 * 제목은 정적으로 둔다 — `generateMetadata`에서 글을 조회하면 문서 제목이
 * 서버에서 렌더돼 권한 판단 전에 노출된다 (회의록·예산안은 제목 자체도
 * 임원 전용 정보다).
 */
export const metadata: Metadata = {
  title: "문서",
  robots: { index: false, follow: false },
};

/**
 * 문서 상세 `/my/documents/[slug]` — 회의록·예산안 (FR-DOC-03/04).
 *
 * `/news/[slug]`·`/my/notices/[slug]`와 달리 **본문을 서버에서 가져오지
 * 않는다.** 두 화면은 서버 컴포넌트에서 `api.posts.get`을 호출하지만, 이
 * 화면의 내용은 임원 전용이라 같은 방식이면 권한 검사(클라이언트)보다 먼저
 * 문서 본문이 HTML에 실려 내려간다. 그래서 조회는 로그인한 브라우저에서만
 * 한다 (`/my/documents` 목록과 동일한 판단 — 그 파일 주석 참고).
 *
 * ⚠️ UI 게이트는 편의일 뿐 인가가 아니다. 서버는 권한이 없으면 존재 자체를
 * 숨기려 `NOT_FOUND`(404)를 돌려준다 (SPEC_API §3.3).
 */
export default async function MyDocumentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main>
      <RequireLeader>
        <DocumentDetail slug={slug} />
      </RequireLeader>
    </main>
  );
}
