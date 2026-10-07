"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { isLeaderOrAbove } from "@/components/auth/RequireLeader";
import type { PostDetail } from "@/types/api";

/**
 * 글 상세에서 상단 고정을 켜고 끄는 임원 전용 버튼 (PM 결정 2026-10-07).
 *
 * 예: 여름 수련회 공지는 수련회 전까지만 중요하다. 지나면 수정 화면까지 들어가지
 * 않고 여기서 한 번에 내린다.
 *
 * 별도 API 없이 **`PUT /api/posts/{id}`(§3.5)에 지금 내용을 그대로 싣고
 * `pinned`만 바꿔 보낸다.** 서버는 이미 게시된 글을 다시 저장해도 게시일을
 * 바꾸지 않으므로(`PostCommandService.resolvePublishedAt`) 고정을 풀어도
 * 원래 날짜 자리로 돌아간다 — 맨 위로 튀어 오르지 않는다.
 *
 * ⚠️ 버튼을 숨기는 것은 편의다. 최종 권한 판단은 서버(§3.5 권한 `L`)가 한다.
 */
export function PinToggleButton({ post }: { post: PostDetail }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // 공개 공지 상세는 ISR이라 props가 바로 갱신되지 않는다 — 화면은 이 값을 따른다
  const [pinned, setPinned] = useState(post.pinned);
  const [message, setMessage] = useState<string | null>(null);

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      api.posts.update(post.id, {
        category: post.category,
        title: post.title,
        body: post.body,
        pinned: next,
        attachmentIds: post.attachments.map((a) => a.id),
        publish: post.publishedAt !== null,
      }),
    onSuccess: async (_, next) => {
      setPinned(next);
      setMessage(next ? "목록 상단에 고정했습니다." : "고정을 해제했습니다. 이제 날짜순으로 보입니다.");
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: (error) => {
      setMessage(isApiError(error) ? error.message : "변경하지 못했습니다. 다시 시도해 주세요.");
    },
  });

  // EditPostLink와 같은 규칙 — 로딩 중에도 그리지 않는다
  if (!user || !isLeaderOrAbove(user.role)) return null;

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          toggle.mutate(!pinned);
        }}
        disabled={toggle.isPending}
        aria-pressed={pinned}
        className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)] disabled:opacity-60"
      >
        {toggle.isPending ? "변경 중..." : pinned ? "📌 고정 해제" : "📌 상단 고정"}
      </button>
      {message && (
        <span role="status" className="text-sm text-[var(--color-gray-400)]">
          {message}
        </span>
      )}
    </span>
  );
}
