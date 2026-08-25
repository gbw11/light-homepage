import type { Metadata } from "next";
import { InternalNoticeList } from "./_components/InternalNoticeList";

export const metadata: Metadata = {
  title: "공지",
  description: "LIGHT 청년교회의 공지를 모두 확인하세요.",
};

/**
 * WIREFRAME.md §14 — 내부 공지 `/notices`.
 * 공개 공지(`NOTICE_PUBLIC`)와 내부 공지(`NOTICE_MEMBER`)를 하나의 목록으로
 * 통합해 보여준다 (SPEC_API §3.1).
 * 공개 열람 전환(PM 결정 2026-08-25): 열람은 로그인 없이 가능하다.
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
 *    그래서 목록은 클라이언트에서만 조회한다 (`/photos`와 동일한 방식).
 */
export default function MyNoticesPage() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        {/*
          제목에서 "내부"를 뺐다 — 공개 열람 전환(PM 결정 2026-08-25) 이후
          이 목록은 누구나 볼 수 있어서, "내부"는 못 보는 사람이 있다는
          반대 정보를 준다. 회원 대상 글은 목록 안에서 뱃지로 구분한다.
        */}
        <h1 className="text-2xl font-bold md:text-3xl">공지</h1>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          공개 공지와 회원 대상 공지를 모두 모았습니다.
        </p>
      </section>

      <InternalNoticeList />
    </main>
  );
}
