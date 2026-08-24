"use client";

/**
 * SPEC_API §6.8 / FR-PHO-05 — ZIP 다운로드는 **한 번에 최대 30장**.
 *
 * 서버도 `VALIDATION_ERROR`(field `ids`)로 막지만, 화면이 먼저 막아야
 * 헛된 요청이 나가지 않는다. 두 곳(선택 로직 · 안내 문구)이 같은 값을 써야
 * 하므로 여기서 한 번만 정의해 내보낸다.
 */
export const MAX_ZIP_PHOTOS = 30;

type SelectionBarProps = {
  count: number;
  /** 30장 제한 등 직전 동작에 대한 안내 — 없으면 기본 안내만 보여준다 */
  notice?: string | null;
};

/**
 * WIREFRAME.md §13-3 — 선택 모드 하단 액션 바.
 *
 * 화면 하단에 고정된다(`fixed`). 무한 스크롤 중에도 선택 장수와 30장 제한이
 * 항상 보여야 하기 때문이다 — 47장을 스크롤하다가 제한에 걸렸을 때 위로
 * 올라가야 이유를 알 수 있으면 안 된다.
 */
export function SelectionBar({ count, notice }: SelectionBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-navy-100)] bg-[var(--background)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-10">
      <div className="mx-auto w-full max-w-[var(--container-max)]">
        <p className="text-center text-base font-bold">
          {count === 0 ? "사진을 선택해주세요" : `${count}장 선택`}
        </p>
        {/*
          제한에 걸린 사실은 조용히 넘기지 않는다 (31번째 클릭이 무시만 되면
          고장으로 보인다). `aria-live`로 스크린리더에도 즉시 전달한다.
        */}
        <p
          aria-live="polite"
          className={`mt-1 text-center text-sm ${
            notice ? "font-bold text-[var(--color-red-500)]" : "text-[var(--color-gray-400)]"
          }`}
        >
          {notice ?? `ⓘ 한 번에 최대 ${MAX_ZIP_PHOTOS}장`}
        </p>
      </div>
    </div>
  );
}
