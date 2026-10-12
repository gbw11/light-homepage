import { Button } from "./Button";

/**
 * 목록 하단 "더 보기" — `useInfiniteQuery` 목록 공통 (SPEC_API §1.6 `hasNext`).
 *
 * WIREFRAME.md의 목록들이 쓰는 방식이다(페이지 번호 대신 이어 붙이기). 다음 페이지가
 * 없으면 아무것도 그리지 않는다 — 누를 수 없는 버튼을 남겨두지 않는다.
 *
 * 받는 값은 `useInfiniteQuery` 결과 그대로다:
 * `<LoadMoreButton hasNextPage={hasNextPage} isFetching={isFetchingNextPage} onClick={() => fetchNextPage()} />`
 */
export function LoadMoreButton({
  hasNextPage,
  isFetching,
  onClick,
}: {
  hasNextPage: boolean;
  isFetching: boolean;
  onClick: () => void;
}) {
  if (!hasNextPage) return null;
  return (
    <div className="mt-6 flex justify-center">
      <Button variant="secondary" onClick={onClick} disabled={isFetching}>
        {isFetching ? "불러오는 중..." : "더 보기"}
      </Button>
    </div>
  );
}
