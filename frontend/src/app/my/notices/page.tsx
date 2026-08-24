import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { RequireMember } from "@/components/auth/RequireMember";
import { InternalNoticeList } from "./_components/InternalNoticeList";

export const metadata: Metadata = {
  title: "내부 공지",
  description: "LIGHT 청년교회 회원 대상 내부 공지를 확인하세요.",
};

/**
 * WIREFRAME.md §14 — 내부 공지 `/my/notices`.
 * 공개 공지(`NOTICE_PUBLIC`)와 내부 공지(`NOTICE_MEMBER`)를 하나의 목록으로
 * 통합해 보여준다 (SPEC_API §3.1). 회원(`M`) 이상만 접근 가능하므로
 * `RequireMember`로 감싼다.
 *
 * 두 분류 모두 서버에서 prefetch해 초기 HTML에 목록이 바로 보이게 하고,
 * 클라이언트의 `InternalNoticeList`가 동일 쿼리 키로 이어받는다
 * (`/news` 페이지와 동일한 SSR 하이드레이션 패턴).
 *
 * `RequireMember`는 훅을 쓰는 클라이언트 컴포넌트라 페이지 자체는 서버
 * 컴포넌트로 유지하고, prefetch된 데이터를 그 안쪽(`InternalNoticeList`)에
 * 흘려보낸다.
 */
export default async function MyNoticesPage() {
  const queryClient = new QueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: ["posts", "NOTICE_PUBLIC"],
      queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
    }),
    queryClient.prefetchQuery({
      queryKey: ["posts", "NOTICE_MEMBER"],
      queryFn: () => api.posts.list({ category: "NOTICE_MEMBER" }),
    }),
  ]);

  return (
    <main>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <h1 className="text-2xl font-bold md:text-3xl">내부 공지</h1>
      </section>

      <RequireMember>
        <HydrationBoundary state={dehydrate(queryClient)}>
          <InternalNoticeList />
        </HydrationBoundary>
      </RequireMember>
    </main>
  );
}
