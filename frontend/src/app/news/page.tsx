import type { Metadata } from "next";
import Link from "next/link";
import { NoticeList } from "./_components/NoticeList";

export const metadata: Metadata = {
  title: "소식",
  description: "LIGHT 청년교회의 공지와 소식을 확인하세요.",
};

/**
 * WIREFRAME.md §7 — 소식 `/news`.
 * 이번 단위는 공지 탭만 구현한다. 갤러리 탭은 사진첩(앨범) 기능이 필요한
 * M3 범위라 이번 단위에서는 생략한다.
 *
 * ⚠️ **서버에서 prefetch하지 않는다.** 예전에는 `posts.list`를 서버에서 미리
 * 채워 초기 HTML에 목록을 실었는데, **백엔드가 없는 환경에서 빌드가 멈춘다.**
 * `API_ORIGIN`이 없으면 `next.config.ts`의 rewrite가 비어서 `/api/**` 요청이
 * 갈 곳을 잃고, 정적 생성이 응답을 기다리다 60초 타임아웃으로 실패한다
 * (실제로 CI의 `mock=0` 빌드가 이렇게 3회 재시도 끝에 죽었다. 로컬에서는
 * `.env.local`의 `API_ORIGIN` 덕에 즉시 connection refused가 나서 통과하는
 * 바람에 더 늦게 발견됐다).
 *
 * `frontend-ci.yml`이 `mock=0` 빌드를 검증하는 이유가 정확히 이 부류의 버그다.
 * 목록은 `NoticeList`가 클라이언트에서 조회한다 — 다른 목록 화면들과 같은 방식.
 *
 * ISR(`revalidate`)도 함께 걷어냈다. 서버에서 데이터를 읽지 않으므로 이 페이지의
 * 정적 HTML에는 재생성할 내용이 없다(껍데기뿐이다).
 */
export default function NewsPage() {
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
          {/*
            갤러리는 별도 탭을 만들지 않고 사진첩(`/photos`)으로 보낸다.
            예전에는 사진첩이 회원 전용이라 비활성 탭으로 두고 "M3에서
            추가됩니다"를 띄웠는데, 공개 열람 전환(PM 결정 2026-08-25)으로
            `/photos`가 누구에게나 열렸다. 같은 사진을 두 곳에서 관리할 이유가
            없으므로 탭 자리를 링크로 쓴다.
          */}
          <Link
            href="/photos"
            className="inline-flex min-h-11 items-center px-4 py-3 text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
          >
            갤러리
          </Link>
        </div>
      </section>

      <NoticeList />
    </main>
  );
}
