"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { AuthUser } from "@/types/api";
import { Button } from "@/components/ui/Button";

const ROLE_LABELS: Record<AuthUser["role"], string> = {
  GUEST: "손님",
  PENDING: "승인 대기",
  MEMBER: "일반 회원",
  LEADER: "임원",
  PASTOR: "목회자",
};

const VILLAGE_LABELS: Record<string, string> = {
  "1": "1마을",
  "2": "2마을",
  "3": "3마을",
  "4": "4마을",
  "5": "5마을",
  "6": "6마을",
  "7": "7마을",
  "8": "8마을",
  "9": "9마을",
  newcomer: "새가족",
};

const PHONE_REGEX = /^010-\d{4}-\d{4}$/;

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base outline-none focus:border-[var(--color-yellow)]";

interface ProfileInfoProps {
  user: AuthUser;
  onUpdated: () => void;
}

/** WIREFRAME.md §14 우측 — 이름/이메일/마을/권한은 읽기 전용, 연락처만 인라인 수정 */
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
        <dt className="text-sm font-bold text-[var(--color-gray-400)]">이메일</dt>
        <dd className="text-base">{user.email ?? "-"}</dd>
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
                className="text-sm font-bold text-[var(--color-yellow)] underline-offset-2 hover:underline"
                onClick={() => setIsEditing(true)}
              >
                수정
              </button>
            </div>
          )}
          {error && <p className="text-sm text-[var(--color-red-500)]">{error}</p>}
        </dd>
      </div>

      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm font-bold text-[var(--color-gray-400)]">마을</dt>
        <dd className="text-base">{VILLAGE_LABELS[user.village] ?? user.village}</dd>
      </div>

      <div className="flex items-center justify-between gap-4">
        <dt className="text-sm font-bold text-[var(--color-gray-400)]">권한</dt>
        <dd className="text-base">{ROLE_LABELS[user.role]}</dd>
      </div>
    </dl>
  );
}
