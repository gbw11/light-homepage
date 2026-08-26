import type { Metadata } from "next";
import { DocumentBoard } from "./_components/DocumentBoard";

export const metadata: Metadata = {
  title: "문서",
  description: "LIGHT 청년교회 문서 게시판 — 회의록·예산안.",
};

/**
 * 문서 게시판 `/documents` — 회의록·예산안 (FR-DOC-03/04, M4).
 *
 * **라우트 구성 판단**: WIREFRAME.md §15(관리 홈)는 "문서 ▸ 회의록 ▸ 예산안"을
 * 두 항목으로 나열하지만, SPEC_FUNCTIONAL §7.1이 "회의록과 예산안의 접근
 * 권한이 동일하다(임원 이상). 분류는 목록 구분 목적으로만 유지한다"고 못박고
 * 있다. 그래서 화면은 **한 라우트 + 분류 탭 2개**로 만들었다 — 권한 게이트를
 * 두 군데로 복사하지 않는 쪽이 안전하고(보안 요구 최상 구간, WIREFRAME §
 * 구현 순서 6번), 와이어프레임의 두 항목은 같은 화면의 두 탭으로 대응된다.
 * (§16 `/admin/posts/new`는 작성 화면이라 이 작업 범위 밖이다.)
 *
 * ⚠️ **서버에서 prefetch하지 않는다.** 예산안이 섞여 있어서이고
 * (그 페이지 주석 참고 — 세션이 필요한 데이터를 정적 HTML에 구우면 안 된다),
 * 회의록·예산안은 그 위험이 더 크다: 임원 전용 문서가 초기 HTML에 실려
 * 권한 없는 사용자의 브라우저까지 내려가는 일이 없어야 한다. 목록과 상세
 * 모두 **로그인한 브라우저에서만** 조회한다.
 */
export default function MyDocumentsPage() {
  return (
    <main id="main" tabIndex={-1}>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pt-16 md:px-10 md:pt-24">
        <h1 className="text-2xl font-bold md:text-3xl">문서</h1>
        <p className="mt-1 text-sm text-[var(--color-gray-400)]">
          회의록은 누구나 볼 수 있습니다. 예산안은 임원 이상만 열람할 수 있습니다.
        </p>
      </section>

      <DocumentBoard />
    </main>
  );
}
