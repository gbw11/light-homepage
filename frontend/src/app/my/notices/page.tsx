import type { Metadata } from "next";
import { RequireMember } from "@/components/auth/RequireMember";
import { InternalNoticeList } from "./_components/InternalNoticeList";

export const metadata: Metadata = {
  title: "내부 공지",
  description: "LIGHT 청년교회 회원 대상 내부 공지를 확인하세요.",
};

/**
 * WIREFRAME.md §14 — 내부 공지 `/my/notices`.
 * 공개 공지(`NOTICE_PUBLIC`)와 내부 공지(`NOTICE_MEMBER`)를 하나의 목록으로
 * 통합해 보여준다 (SPEC_API §3.1). 회원(`M`) 이상만 접근 가능하다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다.** `/news`(공개 페이지)와 다른 점이고,
 *    의도된 차이다:
 *
 *    1. 이 목록은 **세션이 필요한 데이터**다. 빌드·프리렌더 시점에는 쿠키가
 *       없으므로 prefetch가 성공할 수 없다. mock 모드에서는 세션이
 *       localStorage(브라우저 전용)에 있어 서버에서 항상 비어 있고,
 *       실제 백엔드에서는 401이 된다
 *    2. 만약 어떤 경로로든 **성공한다면 그게 더 위험하다** — 특정 사용자의
 *       회원 전용 데이터가 정적 HTML에 구워져 배포된다
 *    3. 실제로 `NEXT_PUBLIC_USE_MOCK=0`으로 빌드하면 이 prefetch가 응답을
 *       기다리다 정적 생성이 타임아웃되어 **빌드 자체가 실패**했다
 *
 *    그래서 목록은 클라이언트에서만 조회한다 (`/my/photos`와 동일한 방식).
 */
export default function MyNoticesPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <h1 className="text-2xl font-bold md:text-3xl">내부 공지</h1>
      </section>

      <RequireMember>
        <InternalNoticeList />
      </RequireMember>
    </main>
  );
}
