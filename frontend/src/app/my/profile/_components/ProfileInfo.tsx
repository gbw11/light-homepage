"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { AuthUser } from "@/types/api";
import { Button } from "@/components/ui/Button";

const ROLE_LABELS: Record<AuthUser["role"], string> = {
  GUEST: "손님",
  MEMBER: "일반 회원",
  LEADER: "임원",
  PASTOR: "목회자",
};

const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

interface ProfileInfoProps {
  user: AuthUser;
  onUpdated: () => void;
}

/** WIREFRAME.md §14 우측 — 이름/아이디/권한은 읽기 전용, 연락처만 인라인 수정 (v1.3: 이메일·마을 제거) */
export function ProfileInfo({ user, onUpdated }: ProfileInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [phone, setPhone] = useState(user.phone);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (nextPhone: string) => api.auth.updateProfile({ phone: nextPhone }),
    onSuccess: () => {
      setIsEditing(false);
      setError(null);
      onUpdated();
    },
    onError: (err) => {
      setError(isApiError(err) ? err.message : "연락처 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    },
  });

  function handleSave() {
    const trimmed = phone.trim();
    if (!PHONE_REGEX.test(trimmed)) {
      setError("010-0000-0000 형식으로 입력해주세요.");
      return;
    }
    mutation.mutate(trimmed);
  }

  function handleCancel() {
    setPhone(user.phone);
    setError(null);
    setIsEditing(false);
  }

  return (
    <dl className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm font-bold text-[var(--color-gray-400)]">이름</dt>
        <dd className="text-base">{user.name}</dd>
      </div>

      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm font-bold text-[var(--color-gray-400)]">아이디</dt>
        <dd className="text-base">{user.loginId ?? "카카오 로그인"}</dd>
      </div>

      <div className="flex items-center justify-between gap-4">
        <dt className="pt-2 text-sm font-bold text-[var(--color-gray-400)]">연락처</dt>
        <dd className="flex flex-1 flex-col items-end gap-2">
          {isEditing ? (
            <div className="flex w-full max-w-[220px] flex-col items-end gap-2">
              <label htmlFor="phone" className="sr-only">
                연락처
              </label>
              <input
                id="phone"
                type="tel"
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-1234-5678"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="min-h-9 px-4 text-sm"
                  onClick={handleCancel}
                  disabled={mutation.isPending}
                >
                  취소
                </Button>
                <Button
                  type="button"
                  className="min-h-9 px-4 text-sm"
                  onClick={handleSave}
                  disabled={mutation.isPending}
                >
                  {mutation.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-base">{user.phone}</span>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center text-sm font-bold underline underline-offset-2"
                onClick={() => setIsEditing(true)}
              >
                수정
              </button>
            </div>
          )}
          {error && <p role="alert" className="text-sm text-[var(--color-red-500)]">{error}</p>}
        </dd>
      </div>

      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm font-bold text-[var(--color-gray-400)]">권한</dt>
        <dd className="text-base">{ROLE_LABELS[user.role]}</dd>
      </div>
    </dl>
  );
}
