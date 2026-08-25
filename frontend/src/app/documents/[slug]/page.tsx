import type { Metadata } from "next";
import { DocumentDetail } from "../_components/DocumentDetail";

/**
 * 제목은 정적으로 둔다 — `generateMetadata`에서 글을 조회하면 문서 제목이
 * 서버에서 렌더돼 권한 판단 전에 노출된다. 예산안은 제목 자체도 임원 전용
 * 정보이므로 분류를 알기 전에는 어느 쪽도 제목을 싣지 않는다.
 */
export const metadata: Metadata = {
  title: "문서",
  robots: { index: false, follow: false },
};

/**
 * 문서 상세 `/documents/[slug]` — 회의록·예산안 (FR-DOC-03/04).
 *
 * 열람 권한이 분류마다 다르다 (PM 결정 2026-08-25): 회의록은 공개, 예산안은
 * 임원 이상. slug만으로는 어느 쪽인지 알 수 없으므로 **화면에 게이트를 두지
 * 않고 서버 판정에 맡긴다** — 권한이 없으면 서버가 존재 자체를 숨겨
 * `NOT_FOUND`(404)를 돌려주고(SPEC_API §3.3), `DocumentDetail`이 그대로
 * "찾을 수 없는 문서"로 렌더한다.
 *
 * `/news/[slug]`와 달리 **본문을 서버에서 가져오지 않는다.** 예산안 본문이
 * 권한 판단보다 먼저 HTML에 실려 내려가는 일이 없어야 하기 때문이다.
 */
export default async function MyDocumentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <main id="main" tabIndex={-1}>
      {/*
        `h1`은 권한 결과와 무관하게 항상 렌더한다. 글 제목을 `h1`으로 쓰면
        (a) 권한이 없을 때 페이지에 h1이 사라지고 (b) 제목 자체가 임원 전용
        정보인데 문서 구조 최상단에 놓이게 된다. 그래서 중립적인 "문서"를
        쓰고, 글 제목은 `DocumentDetail`에서 `h2`로 렌더한다.
      */}
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <h1 className="text-2xl font-bold md:text-3xl">문서</h1>
      </section>

      <DocumentDetail slug={slug} />
    </main>
  );
}
