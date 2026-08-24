"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { useAuth } from "@/components/providers/AuthProvider";
import { Button } from "@/components/ui/Button";

const inputClass =
  "min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]";

/** WIREFRAME.md §14 — ▸ 로그아웃 · ▸ 회원 탈퇴 */
export function AccountActions() {
  const router = useRouter();
  const { logout, refetch } = useAuth();

  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: () => router.push("/"),
  });

  const deleteMutation = useMutation({
    mutationFn: (pw: string) => api.auth.deleteAccount({ password: pw }),
    onSuccess: () => {
      refetch();
      router.push("/");
    },
    onError: (err) => {
      setError(isApiError(err) ? err.message : "회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.");
    },
  });

  function handleWithdraw() {
    if (!password) {
      setError("비밀번호를 입력해주세요.");
      return;
    }
    const confirmed = window.confirm(
      "정말 탈퇴하시겠습니까? 탈퇴 시 개인정보는 즉시 파기되며 되돌릴 수 없습니다.",
    );
    if (!confirmed) return;
    setError(null);
    deleteMutation.mutate(password);
  }

  return (
    <div className="space-y-6">
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? "로그아웃 중..." : "▸ 로그아웃"}
        </Button>
      </div>

      <div>
        {!isWithdrawOpen ? (
          <button
            type="button"
            className="text-base font-bold text-[var(--color-red-500)] hover:underline"
            onClick={() => setIsWithdrawOpen(true)}
          >
            ▸ 회원 탈퇴
          </button>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              className="text-base font-bold text-[var(--color-red-500)] hover:underline"
              onClick={() => {
                setIsWithdrawOpen(false);
                setPassword("");
                setError(null);
              }}
            >
              ▾ 회원 탈퇴
            </button>
            <p className="text-sm text-[var(--color-gray-400)]">
              탈퇴 시 개인정보가 즉시 파기되며 되돌릴 수 없습니다. 확인을 위해
              비밀번호를 입력해주세요.
            </p>
            <label htmlFor="withdraw-password" className="sr-only">
              비밀번호
            </label>
            <input
              id="withdraw-password"
              type="password"
              autoComplete="current-password"
              className={inputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="text-sm text-[var(--color-red-500)]">{error}</p>}
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-6 text-base font-bold text-white transition hover:brightness-95 disabled:opacity-60"
              onClick={handleWithdraw}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "탈퇴 처리 중..." : "탈퇴 확정"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
