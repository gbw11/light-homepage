/**
 * `/documents`가 처음 열 탭.
 *
 * ⚠️ 이 파일에는 `"use client"`를 붙이지 않는다. `page.tsx`(서버 컴포넌트)가 이 함수를
 * **호출**하는데, 클라이언트 모듈(`DocumentBoard.tsx`)에 두면 서버에서는 함수가 아니라
 * 클라이언트 참조라 "Attempted to call parseDocumentTab() from the server"로 페이지가
 * 통째로 깨진다. 빌드는 통과하고 요청 때만 터진다.
 */
export type DocumentCategory = "MINUTES" | "BUDGET";

/**
 * `/documents?tab=budget` → 예산안 탭으로 연다 (관리 홈 "예산안" 링크).
 * 알 수 없는 값·없음은 기본 탭(회의록)이다.
 */
export function parseDocumentTab(tab: string | string[] | undefined): DocumentCategory {
  return tab === "budget" ? "BUDGET" : "MINUTES";
}
