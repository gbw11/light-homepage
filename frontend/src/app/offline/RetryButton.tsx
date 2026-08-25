"use client";

/**
 * 오프라인 폴백의 [다시 시도] — 원래 가려던 URL을 다시 요청한다.
 *
 * 이 버튼은 **JS가 있을 때와 없을 때 모두** 동작해야 한다. 오프라인 폴백은
 * 정의상 "처음 보는 페이지"라서 클라이언트 청크가 캐시에 있을 수도, 없을
 * 수도 있다 (`public/sw.js`는 요청된 적 있는 `/_next/static/**`만 캐싱한다).
 * 실제로 두 상태를 Playwright로 다 재현했고, 한쪽만 만족하는 구현은 둘 다
 * 죽은 버튼이 됐다:
 *
 *   · `<button onClick>` 만 → 하이드레이션 안 된 상태에서 아무 반응 없음
 *   · `<form method="get">` 만 → **하이드레이션된 상태**에서 React가 submit을
 *     가로채 요청이 나가지 않음 (form.submit() 직접 호출은 됐다)
 *   · `<a href="">` → Chromium이 같은 URL 링크를 재요청 없이 처리
 *
 * 그래서 둘을 겹쳐 쓴다 (점진적 향상):
 *   JS 없음 → 브라우저가 GET 폼을 현재 URL로 전송
 *   JS 있음 → onClick이 기본 동작을 막고 `location.reload()`
 */
export function RetryButton() {
  return (
    <form method="get">
      <button
        type="submit"
        onClick={(event) => {
          event.preventDefault();
          window.location.reload();
        }}
        className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
      >
        다시 시도
      </button>
    </form>
  );
}
