import type { PostCategory } from "@/types/api";

/**
 * 분류 → 그 글의 상세 화면 경로 (SPEC_API §3.1의 열람 권한과 짝을 이룬다).
 *
 * 같은 게시판(`posts`)이지만 읽는 화면은 둘로 갈린다:
 *   · `NOTICE_PUBLIC`·`NOTICE_MEMBER` → `/news/[slug]`  공지 (통합, 2026-08-25)
 *   · `MINUTES`·`BUDGET` → `/documents/[slug]`          문서 (예산안만 임원 전용)
 *
 * 이 매핑이 지금까지 목록 컴포넌트 세 곳에 각자 박혀 있었다. 목록은 자기
 * 분류 하나만 알면 되니 그래도 됐지만, 글 수정 화면은 **분류 4종을 다 다루고
 * 저장 후 어디로 보낼지 정해야 한다** — 그 시점에 분기를 한 곳으로 모은다.
 * 분류가 늘면 여기만 고치면 된다.
 */
export function postHref(category: PostCategory, slug: string): string {
  switch (category) {
    case "NOTICE_PUBLIC":
    case "NOTICE_MEMBER":
      return `/news/${slug}`;
    case "MINUTES":
    case "BUDGET":
      return `/documents/${slug}`;
  }
}
