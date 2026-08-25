"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * FR-PHO-09 · SPEC_API §6.3 — 앨범 삭제 (권한 `L`).
 *
 * ## 왜 앨범 목록이 아니라 앨범 상세 **맨 아래**인가
 *
 * `§6.3`은 앨범과 함께 **사진·R2 객체를 모두 삭제**한다. 되돌릴 수 없다.
 * 앨범 목록(`/my/photos`)의 카드 옆에 삭제 버튼을 두면 3열 그리드에서
 * 옆 카드를 누르려던 손가락 하나가 47장을 지운다 — 그래서 목록에는 두지 않고,
 * **그 앨범 안에 들어가 사진을 다 본 뒤에야 닿는 위치**에 둔다.
 * 정상적인 열람 흐름(목록 → 앨범 → 라이트박스)에서는 지나칠 일이 없다.
 *
 * ## 확인 절차 (3단)
 *
 * 1. 접힌 상태 — 펼치지 않으면 삭제 버튼 자체가 없다
 * 2. **앨범 제목을 그대로 타이핑**해야 확정 버튼이 활성화된다
 * 3. `window.confirm`에 장수를 넣어 마지막으로 되묻는다
 *
 * `AccountActions`(회원 탈퇴)가 이미 "타이핑 확인 + `confirm()`" 조합을 쓴다 —
 * 같은 급의 비가역 동작이라 같은 무게로 맞췄다. `confirm()` 하나만 두는 쪽은
 * 반사적으로 Enter를 눌러 넘길 수 있고, 무엇보다 **어느 앨범인지**를 확인시키지
 * 못한다. 제목을 손으로 옮겨 적게 하면 "지금 보고 있는 앨범이 맞나"를 강제로
 * 읽게 된다.
 *
 * ⚠️ 역할로 감추는 건 UI 편의다 — 실제 인가는 서버가 한다
 * (`RequireLeader` 주석 · WORKPLAN §5.1). 서버의 `FORBIDDEN`도 정상 경로로 받는다.
 */
export function AlbumDangerZone({
  albumId,
  title,
  photoCount,
}: {
  albumId: string;
  /** 타이핑 확인의 정답. 제목을 모르면(목록 조회 실패) 이 영역을 렌더하지 않는다 */
  title: string;
  /** 함께 파괴되는 사진 장수 (`§6.1`의 `photoCount`) — 문구에 그대로 박는다 */
  photoCount: number;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => api.albums.remove(albumId),
    onSuccess: async () => {
      // 앨범 목록(`["albums"]`)과 이 앨범의 사진 무한 쿼리가 모두 이 접두사에
      // 걸린다 — 지운 앨범이 캐시에 남아 있으면 목록에 유령이 보인다.
      await queryClient.invalidateQueries({ queryKey: ["albums"] });
      // 삭제한 앨범 상세에 머무를 수 없다 (다음 조회는 404다)
      router.replace("/my/photos");
    },
    onError: (err) => {
      setError(
        isApiError(err) ? err.message : "앨범을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  // 임원·목회자가 아니면 이 영역은 존재하지 않는다 (SPEC_API §6.3 권한 `L`).
  // `RequireLeader`로 감싸지 않는 이유: 그 컴포넌트는 "권한이 없습니다" 패널을
  // 렌더하는데, 일반 회원이 앨범을 볼 때마다(§6.4 권한 `M` — 정상 열람이다)
  // 맨 아래에 그 패널이 붙으면 열람이 거부된 것처럼 읽힌다. 그래서 판정 함수만
  // 재사용하고 렌더는 생략한다 (`CreateAlbumSection`과 같은 방식).
  if (!user || !isLeaderOrAbove(user.role)) return null;

  const confirmed = typed.trim() === title.trim();

  function handleDelete() {
    if (!confirmed) return;
    const ok = window.confirm(
      photoCount > 0
        ? `앨범 "${title}"과(와) 안에 있는 사진 ${photoCount}장을 영구 삭제합니다.\n사진 파일까지 함께 지워지며 되돌릴 수 없습니다.\n\n삭제하시겠습니까?`
        : `앨범 "${title}"을(를) 영구 삭제합니다. 되돌릴 수 없습니다.\n\n삭제하시겠습니까?`,
    );
    if (!ok) return;
    setError(null);
    mutation.mutate();
  }

  return (
    <section className="mx-auto w-full max-w-[var(--container-max)] px-5 pb-16 md:px-10 md:pb-24">
      <div className="rounded-[var(--radius-card)] border border-[var(--color-red-500)]/40 p-5">
        <h2 className="text-sm font-bold text-[var(--color-red-500)]">임원 전용 · 되돌릴 수 없는 작업</h2>

        {!open ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={false}
            // 접근성: 이름이 "삭제"만이면 무엇을 지우는지 알 수 없다 —
            // 앨범명과 장수를 이름에 넣는다
            aria-label={
              photoCount > 0
                ? `앨범 ${title} 삭제 — 사진 ${photoCount}장이 함께 삭제됩니다`
                : `앨범 ${title} 삭제`
            }
            className="mt-3 inline-flex min-h-11 items-center text-base font-bold text-[var(--color-red-500)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red-500)]"
          >
            ▸ 앨범 삭제
          </button>
        ) : (
          <div className="mt-3 space-y-3">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setTyped("");
                setError(null);
              }}
              aria-expanded
              className="inline-flex min-h-11 items-center text-base font-bold text-[var(--color-red-500)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red-500)]"
            >
              ▾ 앨범 삭제
            </button>

            {/* 결과를 구체적으로 — "정말 삭제하시겠습니까?"로는 47장이 사라지는 걸 알 수 없다 */}
            <p className="text-sm leading-relaxed">
              {photoCount > 0 ? (
                <>
                  앨범 <strong className="font-bold">{title}</strong>을(를) 삭제하면{" "}
                  <strong className="font-bold text-[var(--color-red-500)]">
                    안에 있는 사진 {photoCount}장이 함께 영구 삭제
                  </strong>
                  됩니다. 사진 파일까지 저장소에서 지워지므로{" "}
                  <strong className="font-bold">되돌릴 수 없고, 복구 요청도 받을 수 없습니다.</strong>
                </>
              ) : (
                <>
                  앨범 <strong className="font-bold">{title}</strong>을(를) 영구 삭제합니다. 이
                  앨범에는 사진이 없습니다.{" "}
                  <strong className="font-bold">되돌릴 수 없습니다.</strong>
                </>
              )}
            </p>

            <div>
              <label htmlFor="delete-album-confirm" className="mb-1 block text-sm font-bold">
                확인을 위해 앨범 제목 <span className="text-[var(--color-red-500)]">{title}</span>을(를)
                그대로 입력해주세요
              </label>
              <input
                id="delete-album-confirm"
                value={typed}
                autoComplete="off"
                onChange={(e) => setTyped(e.target.value)}
                aria-describedby="delete-album-confirm-hint"
                className="min-h-11 w-full max-w-sm rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-red-500)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red-500)]"
              />
              <p id="delete-album-confirm-hint" className="mt-1 text-sm text-[var(--color-gray-400)]">
                제목이 정확히 일치하면 삭제 버튼이 켜집니다.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-sm font-bold text-[var(--color-red-500)]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleDelete}
              disabled={!confirmed || mutation.isPending}
              aria-label={
                photoCount > 0
                  ? `앨범 ${title}과 사진 ${photoCount}장 영구 삭제 확정`
                  : `앨범 ${title} 영구 삭제 확정`
              }
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-6 text-base font-bold text-[var(--color-danger-fg)] transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-red-500)] disabled:opacity-50"
            >
              {mutation.isPending ? "삭제 중..." : "앨범 삭제 확정"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
