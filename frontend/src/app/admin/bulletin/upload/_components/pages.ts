/**
 * 업로드 대기 중인 주보 한 장 (WIREFRAME §17).
 *
 * **배열 순서가 곧 페이지 번호다** (SPEC_API §5.4 "순서 = 페이지 순서").
 * 그래서 항목에 페이지 번호를 저장하지 않는다 — 두 곳에 같은 정보를 두면
 * 순서를 바꿀 때마다 어긋날 여지가 생긴다.
 */
export type PendingPage = {
  /** 목록 key. 같은 파일을 두 번 고를 수 있으므로 파일명은 key가 될 수 없다 */
  id: string;
  file: File;
  /** 미리보기용 objectURL — 제거·언마운트 시 반드시 revoke한다 */
  previewUrl: string;
};

let pageIdSeq = 0;
export function nextPageId(): string {
  pageIdSeq += 1;
  return `p${pageIdSeq}`;
}

/**
 * `from`을 `to` 위치로 옮긴 새 배열.
 *
 * 범위를 벗어난 요청은 **원본을 그대로 돌려준다** — 첫 항목의 [위로]를 눌러도
 * 아무 일도 일어나지 않아야 한다 (버튼을 비활성으로 두지만, 순서 변경은
 * 드래그로도 들어오므로 여기서도 막는다).
 */
export function move<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return [...items];
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
