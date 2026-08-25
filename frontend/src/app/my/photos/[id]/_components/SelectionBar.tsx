"use client";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/**
 * SPEC_API §6.8 / FR-PHO-05 — ZIP 다운로드는 **한 번에 최대 30장**.
 *
 * 서버도 `VALIDATION_ERROR`(field `ids`)로 막지만, 화면이 먼저 막아야
 * 헛된 요청이 나가지 않는다. 두 곳(선택 로직 · 안내 문구)이 같은 값을 써야
 * 하므로 여기서 한 번만 정의해 내보낸다.
 */
export const MAX_ZIP_PHOTOS = 30;

type SelectionBarProps = {
  albumId: string;
  /** 선택된 사진 id — ZIP 요청의 `ids` 파라미터가 된다 (§6.8) */
  selectedIds: string[];
  /** 30장 제한 등 직전 동작에 대한 안내 — 없으면 기본 안내만 보여준다 */
  notice?: string | null;
  /** 안내 문구를 갱신한다 (안내의 소유자는 부모 — 선택 동작과 한 곳에서 관리) */
  onNotice: (message: string | null) => void;
};

/**
 * WIREFRAME.md §13-3 — 선택 모드 하단 액션 바.
 *
 * 화면 하단에 고정된다(`fixed`). 무한 스크롤 중에도 선택 장수와 30장 제한이
 * 항상 보여야 하기 때문이다 — 47장을 스크롤하다가 제한에 걸렸을 때 위로
 * 올라가야 이유를 알 수 있으면 안 된다.
 */
export function SelectionBar({ albumId, selectedIds, notice, onNotice }: SelectionBarProps) {
  const count = selectedIds.length;
  const canDownload = count > 0;
  /**
   * mock은 ZIP 스트리밍을 만들 수 없다 (`api.capabilities.zipDownload === false`).
   * 이때 앵커로 이동시키면 브라우저가 존재하지 않는 엔드포인트를 열어 실패하고,
   * 성공 문구를 띄우면 거짓말이 된다 — **왜 안 되는지 그대로 말한다.**
   */
  const zipAvailable = api.capabilities.zipDownload;
  const href = canDownload ? api.albums.downloadUrl(albumId, selectedIds) : undefined;
  const label = `⬇ ${count}장 다운로드 (ZIP)`;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--color-navy-100)] bg-[var(--background)] px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:px-10">
      {/* 데스크톱에서 버튼이 컨테이너 전폭으로 늘어나지 않게 폭을 제한한다 */}
      <div className="mx-auto w-full max-w-lg">
        <p className="text-center text-base font-bold">
          {count === 0 ? "사진을 선택해주세요" : `${count}장 선택`}
        </p>
        {zipAvailable ? (
          /*
            ZIP도 fetch가 아니라 브라우저가 직접 받아야 한다 (스트리밍 응답을
            fetch로 받으면 파일 전체가 메모리에 올라간다 — SPEC_API §6.8).
            선택이 0장이면 링크가 될 수 없으므로 비활성 버튼으로 바꿔 렌더한다.
          */
          canDownload ? (
            <a
              href={href}
              download
              className="mt-3 flex min-h-11 w-full items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-yellow)] px-6 text-base font-bold text-[var(--color-accent-fg)] transition hover:brightness-95"
            >
              {label}
            </a>
          ) : (
            <Button type="button" className="mt-3 w-full" disabled>
              {label}
            </Button>
          )
        ) : (
          <Button
            type="button"
            className="mt-3 w-full"
            disabled={!canDownload}
            onClick={() =>
              onNotice(
                `mock 모드에서는 ZIP 파일을 만들 수 없습니다 (서버가 스트리밍하는 응답 — SPEC_API §6.8). 실서비스에서는 선택한 ${count}장이 ZIP으로 내려옵니다: ${href}`,
              )
            }
          >
            {label}
          </Button>
        )}

        {/*
          제한·mock 미지원 같은 사실은 조용히 넘기지 않는다 (31번째 클릭이
          무시만 되면 고장으로 보인다). `aria-live`로 스크린리더에도 전달한다.
        */}
        <p
          aria-live="polite"
          className={`mt-2 text-center text-sm break-all ${
            notice ? "font-bold text-[var(--color-red-500)]" : "text-[var(--color-gray-400)]"
          }`}
        >
          {notice ?? `ⓘ 한 번에 최대 ${MAX_ZIP_PHOTOS}장`}
        </p>
      </div>
    </div>
  );
}
