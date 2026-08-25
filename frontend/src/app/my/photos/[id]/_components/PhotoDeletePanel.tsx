"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";

/**
 * ⚠️ mock은 사진을 실제로 지우지 않는다 — `public/photos/`의 정적 파일이라
 * 지울 대상이 없다 (`mock.ts` `photos.remove` 주석). 그래서 삭제가 성공해도
 * 목록을 다시 불러오면 그 사진이 그대로 있다.
 *
 * 화면이 "삭제됐습니다"만 말하고 사진이 되살아나면 버그로 보인다. 낙관적
 * 제거로 감추는 쪽이 더 나쁘다 — 새로고침 한 번에 부활해서 "지운 게 안 지워진다"는
 * 오해를 만든다. 그래서 **낙관적 제거를 하지 않고**, mock 빌드에서만 왜 남아
 * 있는지를 문구로 덧붙인다.
 *
 * `api.capabilities`에는 아직 삭제 관련 플래그가 없고(`zipDownload`만 있다) 이
 * 브랜치에서 `src/lib/api/**`는 계약 고정 상태다. `NEXT_PUBLIC_USE_MOCK`은
 * `api` 스위치가 읽는 바로 그 값이고 빌드 타임 상수이므로, `=0` 빌드에서는 이
 * 문구가 번들에서 사라진다. (`capabilities.hardDelete` 추가가 더 깔끔하다 —
 * BACKEND_HANDOFF에 남겼다.)
 */
const MOCK_NO_OP_NOTE =
  process.env.NEXT_PUBLIC_USE_MOCK === "1"
    ? " (mock 모드: 사진이 정적 파일이라 실제로 지워지지 않습니다 — 목록에 그대로 보이는 것이 정상입니다)"
    : "";

/**
 * FR-PHO-09 · SPEC_API §6.9 — 사진 1장 삭제 (권한 `L`). R2 객체까지 지운다.
 *
 * ## 왜 라이트박스 안인가 (그리드·선택 모드가 아니라)
 *
 * · **그리드에는 두지 않는다.** 무한 스크롤하는 썸네일 옆의 삭제 버튼은
 *   오탭 한 번이 곧 영구 삭제다.
 * · **선택 모드에도 붙이지 않는다.** 선택 모드의 뜻은 지금 "ZIP으로 내려받을
 *   사진 고르기"(FR-PHO-05)다. 같은 선택에 삭제를 얹으면 하단 바에서 버튼
 *   하나 잘못 누른 사용자가 다운로드 대신 30장을 지운다. 게다가 `§6.9`에는
 *   대량 삭제 엔드포인트가 없어 N번 순차 요청이 되고, 중간 실패 시 "몇 장은
 *   지워지고 몇 장은 남은" 상태를 사용자에게 설명해야 한다 — 되돌릴 수 없는
 *   동작에서 만들면 안 되는 상태다. 그래서 **1장씩만** 지운다.
 * · 라이트박스는 지울 사진이 화면 전체에 떠 있는 유일한 자리다. `⋮` → 메뉴 →
 *   이 패널까지 **의도적인 3번의 탭**을 거쳐야 도달한다.
 *
 * 앨범 삭제(`AlbumDangerZone`)와 달리 제목 타이핑·`confirm()`을 요구하지 않는다:
 * 대상이 1장이고 눈앞에 보이며 피해 범위가 확정적이다. 대신 취소 버튼에 초기
 * 포커스를 둬서 무심코 누른 Enter가 삭제가 아닌 취소가 되게 한다.
 */
export function PhotoDeletePanel({
  albumId,
  photoId,
  /** 화면 표시용 위치 (`12 / 47`) — 어느 사진인지 문구로 특정한다 */
  position,
  total,
  onClose,
  /** 삭제 성공 — 라이트박스를 닫고 목록에 결과 안내를 띄운다 */
  onDeleted,
}: {
  albumId: string;
  photoId: string;
  position: number;
  total: number;
  onClose: () => void;
  onDeleted: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.photos.remove(photoId),
    onSuccess: async () => {
      // 낙관적 제거를 하지 않는다 (파일 상단 주석). 서버가 준 결과만 보여준다.
      // `photoCount`가 바뀌므로 앨범 목록(`["albums"]`)도 같이 무효화한다.
      await queryClient.invalidateQueries({ queryKey: ["albums", albumId, "photos"] });
      await queryClient.invalidateQueries({ queryKey: ["albums"] });
      onDeleted(`${position}번째 사진을 삭제했습니다.${MOCK_NO_OP_NOTE}`);
    },
    onError: (err) => {
      setError(
        isApiError(err) ? err.message : "사진을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`사진 ${position} 삭제 확인`}
      className="absolute inset-x-0 bottom-0 z-20 max-h-full overflow-y-auto rounded-t-[var(--radius-card)] bg-[var(--background)] p-5"
      onKeyDown={(e) => {
        // 라이트박스의 전역 키 핸들러(←/→ 이동, Esc 닫기)로 새지 않게 막는다 —
        // 삭제 확인 중에 ←/→로 사진이 넘어가면 다른 사진을 지우게 된다
        e.stopPropagation();
        if (e.key === "Escape") onClose();
      }}
    >
      <p className="text-lg font-bold text-[var(--color-red-500)]">사진 삭제</p>
      {/* 무엇이 사라지는지 구체적으로 — "이 사진"만으로는 어느 사진인지 알 수 없다 */}
      <p className="mt-2 text-sm leading-relaxed">
        지금 보고 있는 <strong className="font-bold">{position}번째 사진 (전체 {total}장 중 1장)</strong>
        을 저장소에서 삭제합니다. 사진 파일까지 함께 지워지므로{" "}
        <strong className="font-bold">되돌릴 수 없고, 복구 요청도 받을 수 없습니다.</strong>
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-gray-400)]">
        본인이 찍힌 사진을 내려달라는 회원 요청이라면, 요청 내용을 확인한 뒤 이곳에서
        해당 사진만 지워주세요 (SPEC_API §6.10 신고·요청).
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-[var(--color-red-500)]">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        {/*
          초기 포커스는 취소다 — 파괴적 동작을 기본 포커스에 두지 않는다.
          (라이트박스의 포커스 트랩이 이 패널 안의 버튼들을 순환시킨다)
        */}
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          autoFocus
          onClick={onClose}
          disabled={mutation.isPending}
        >
          취소
        </Button>
        <button
          type="button"
          onClick={() => {
            setError(null);
            mutation.mutate();
          }}
          disabled={mutation.isPending}
          aria-label={`${position}번째 사진 영구 삭제`}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-6 text-base font-bold text-[var(--color-danger-fg)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50"
        >
          {mutation.isPending ? "삭제 중..." : "영구 삭제"}
        </button>
      </div>
    </div>
  );
}
