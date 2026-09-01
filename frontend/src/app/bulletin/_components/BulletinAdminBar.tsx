"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import { useAuth } from "@/components/providers/AuthProvider";
import { api, isApiError } from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";

/**
 * 주보 화면의 운영자 도구 (FR-BUL-05/06).
 *
 * 임원(`L`) 이상에게만 보인다 — `POST`/`DELETE /api/bulletins`가 `L`이다
 * (SPEC_API §5.4 · §5.5). **감추는 것은 UI 편의일 뿐 인가가 아니다**
 * (WORKPLAN §5.1).
 *
 * 와이어프레임에는 이 줄이 없다. 그런데 업로드 화면(§17)으로 가는 길이
 * 관리 홈에만 있으면, 주보를 보다가 "이번 주 것으로 바꿔야겠다"고 생각한
 * 사람이 화면을 두 번 이동해야 한다. 삭제도 같은 자리에 둔다 — 지울 대상을
 * 보고 있는 화면이 가장 안전하다.
 */
export function BulletinAdminBar({
  bulletin,
  onDeleted,
}: {
  /** 지금 보고 있는 주보. 주보가 하나도 없으면 null */
  bulletin: { id: string; serviceDate: string } | null;
  onDeleted: () => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const remove = useMutation({
    mutationFn: (id: string) => api.bulletins.remove(id),
    onSuccess: async () => {
      setError(null);
      onDeleted();
      await queryClient.invalidateQueries({ queryKey: ["bulletins"] });
    },
    onError: (cause) => {
      setError(
        isApiError(cause) ? cause.message : "주보를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  if (!user || !isLeaderOrAbove(user.role)) return null;

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {confirmDialog}
      <Link
        href="/admin/bulletin/upload"
        className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold hover:bg-[var(--color-navy-100)]"
      >
        주보 올리기
      </Link>

      {bulletin && (
        <button
          type="button"
          disabled={remove.isPending}
          onClick={async () => {
            /*
              되돌릴 수 없는 동작이다 — R2 객체까지 지운다 (§5.5). 날짜를
              문구에 넣는다: 지난 주보를 보다가 눌렀을 때 최신 주보를 지우는
              것으로 착각하면 복구할 방법이 없다.
            */
            const ok = await confirm({
              title: `${bulletin.serviceDate} 주보를 삭제할까요?`,
              description: "이미지 파일까지 함께 지워지고 되돌릴 수 없습니다.",
              confirmLabel: "삭제",
            });
            if (ok) remove.mutate(bulletin.id);
          }}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-red-500)] px-4 text-sm font-bold text-[var(--color-red-500)] transition hover:brightness-95 disabled:opacity-50"
        >
          {remove.isPending ? "삭제 중..." : "이 주보 삭제"}
        </button>
      )}

      {error && (
        <p role="alert" className="w-full text-sm text-[var(--color-red-500)]">
          {error}
        </p>
      )}
    </div>
  );
}
