"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import type { AdminMember } from "@/types/api";
import { formatApplyDate, villageLabel } from "./MemberBoard";

/**
 * WIREFRAME.md §19 승인 대기 카드 — 이름·마을·연락처·신청일 + 승인/거절
 * (FR-ADM-02, SPEC_API §8.2 · §8.3).
 *
 * 승인·거절 모두 **되돌리기 어려운 동작**이라 `window.confirm`을 거친다
 * (FR-ADM-04 수용 기준과 같은 이유 — 이 코드베이스의 확립된 패턴은
 * `my/profile/_components/AccountActions.tsx`).
 *
 * 거절은 사유(`reason`)가 필수라 confirm만으로 처리할 수 없다 —
 * 회원 탈퇴가 비밀번호를 인라인으로 받는 것과 같은 방식으로, 버튼을 누르면
 * 사유 입력이 펼쳐지고 그 다음에 confirm이 뜬다.
 */
export function PendingMemberCard({ member }: { member: AdminMember }) {
  const queryClient = useQueryClient();
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function invalidate() {
    // 승인/거절은 승인 대기 목록과 전체 목록 양쪽을 바꾼다. 관리 홈의
    // 승인 대기 배너도 같은 키(`["admin","members",...]`)를 쓴다.
    queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
  }

  function toMessage(err: unknown, fallback: string): string {
    return isApiError(err) ? err.message : fallback;
  }

  const approveMutation = useMutation({
    mutationFn: () => api.admin.approveMember(member.id),
    onSuccess: invalidate,
    onError: (err) => setError(toMessage(err, "승인에 실패했습니다. 잠시 후 다시 시도해주세요.")),
  });

  const rejectMutation = useMutation({
    mutationFn: (input: string) => api.admin.rejectMember(member.id, { reason: input }),
    onSuccess: () => {
      setIsRejectOpen(false);
      setReason("");
      invalidate();
    },
    onError: (err) => setError(toMessage(err, "거절에 실패했습니다. 잠시 후 다시 시도해주세요.")),
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  function handleApprove() {
    const confirmed = window.confirm(
      `${member.name}님의 가입을 승인하시겠습니까? 승인하면 회원 영역(주보·사진첩·공지)을 바로 이용할 수 있게 됩니다.`,
    );
    if (!confirmed) return;
    setError(null);
    approveMutation.mutate();
  }

  function handleReject() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError("거절 사유를 입력해주세요.");
      return;
    }
    const confirmed = window.confirm(
      `${member.name}님의 가입을 거절하시겠습니까? 되돌릴 수 없습니다.\n\n사유: ${trimmed}`,
    );
    if (!confirmed) return;
    setError(null);
    rejectMutation.mutate(trimmed);
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-5">
      <p className="font-bold">{member.name}</p>
      <p className="mt-1 text-sm text-[var(--color-gray-400)]">
        {villageLabel(member.village)} · {member.phone}
      </p>
      <p className="text-sm text-[var(--color-gray-400)]">
        {formatApplyDate(member.createdAt)} 신청
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" onClick={handleApprove} disabled={isPending}>
          {approveMutation.isPending ? "승인 중..." : "승인"}
        </Button>
        <button
          type="button"
          onClick={() => {
            setIsRejectOpen((open) => !open);
            setError(null);
          }}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-red-500)] px-6 text-base font-bold text-[var(--color-red-500)] transition hover:brightness-95"
        >
          {isRejectOpen ? "▾ 거절" : "거절"}
        </button>
      </div>

      {isRejectOpen && (
        <div className="mt-4 space-y-2">
          <label htmlFor={`reject-reason-${member.id}`} className="block text-sm font-bold">
            거절 사유
          </label>
          <input
            id={`reject-reason-${member.id}`}
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: 청년교회 소속 확인 불가"
            className="min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
          />
          <button
            type="button"
            onClick={handleReject}
            disabled={isPending}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-6 text-base font-bold text-white transition hover:brightness-95 disabled:opacity-60"
          >
            {rejectMutation.isPending ? "거절 처리 중..." : "거절 확정"}
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm font-bold text-[var(--color-red-500)]">
          {error}
        </p>
      )}
    </div>
  );
}
