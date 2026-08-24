"use client";

import Link from "next/link";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * 앨범 상세에서 업로드 화면(`/admin/albums/[id]/upload`)으로 가는 진입점.
 *
 * 임원(`L`) 이상에게만 보여준다 — `uploads:issue`가 `L`이라 일반 회원은
 * 들어가도 발급 단계에서 막힌다 (SPEC_API §6.5). `CreateAlbumSection`과 같은
 * 원칙으로, **감추는 것은 헛걸음을 줄이는 UI 편의일 뿐 인가가 아니다**
 * (WORKPLAN §5.1).
 */
export function UploadLink({ albumId }: { albumId: string }) {
  const { user } = useAuth();

  if (!user || !isLeaderOrAbove(user.role)) return null;

  return (
    <Link
      href={`/admin/albums/${albumId}/upload`}
      className="inline-flex min-h-11 shrink-0 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold hover:bg-[var(--color-navy-100)]"
    >
      사진 올리기
    </Link>
  );
}
