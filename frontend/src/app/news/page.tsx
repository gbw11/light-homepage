import type { Metadata } from "next";
import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { NoticeList } from "./_components/NoticeList";

export const metadata: Metadata = {
  title: "소식",
  description: "LIGHT 청년교회의 공지와 소식을 확인하세요.",
};

/**
 * ISR — 5분마다 재생성한다. 이게 없으면 mock을 끄고 빌드했을 때 목록이
 * **빌드 시점 결과로 영영 굳는다** (Next 15+에서 무지시 fetch는 캐시가
 * 없지만, 정적 라우트라 빌드 때 한 번 실행된 결과가 HTML에 박힌다).
 * 공개 공지는 5분 지연이 문제되지 않고, 요청마다 SSR로 돌리는 것보다
 * 백엔드 부하도 낮다. 회원 영역(/my)은 캐시가 유출이 되므로 쓰지 않는다.
 */
export const revalidate = 300;

/**
 * WIREFRAME.md §7 — 소식 `/news`.
 * 이번 단위는 공지 탭만 구현한다. 갤러리 탭은 사진첩(앨범) 기능이 필요한
 * M3 범위라 이번 단위에서는 생략한다.
 *
 * 서버에서 `posts.list`를 미리 채워(prefetch) 초기 HTML에 목록이 바로
 * 보이게 하고, 클라이언트에서는 `NoticeList`가 동일 쿼리 키로 `useQuery`를
 * 이어받는다 (TanStack Query SSR 하이드레이션 패턴).
 */
export default async function NewsPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: ["posts", "NOTICE_PUBLIC"],
    queryFn: () => api.posts.list({ category: "NOTICE_PUBLIC" }),
  });

  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <h1 className="text-2xl font-bold md:text-3xl">소식</h1>

        <div className="mt-6 flex gap-2 border-b border-[var(--color-navy-100)]">
          <button
            type="button"
            className="border-b-2 border-[var(--color-navy-900)] px-4 py-3 text-sm font-bold"
            aria-current="page"
          >
            공지
          </button>
          {/* 갤러리 탭은 M3(사진첩)에서 추가 */}
          <button
            type="button"
            disabled
            className="px-4 py-3 text-sm font-bold text-[var(--color-gray-400)]"
            title="갤러리 탭은 M3에서 추가됩니다"
          >
            갤러리
          </button>
        </div>
      </section>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <NoticeList />
      </HydrationBoundary>
    </main>
  );
}
