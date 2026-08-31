"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { AdminMember, PasswordResetCode, Role } from "@/types/api";

/** WIREFRAME.md §19 — 일반 / 임원 / 전도사 */
const ROLE_LABEL: Record<Role, string> = {
  GUEST: "비회원",
  MEMBER: "일반",
  LEADER: "임원",
  PASTOR: "전도사",
};

/**
 * 드롭다운에 띄우는 역할.
 *
 * FR-ADM-04는 `MEMBER ↔ LEADER`를 명시하지만 `PASTOR`도 넣는다 — 없으면
 * **전도사 인수인계가 앱 안에서 불가능**해진다 (다음 전도사를 지정할 방법이
 * 없다). 마지막 전도사 강등은 서버가 `VALIDATION_ERROR`로 막으므로
 * (FR-ADM-05) 이 판단이 잠금 위험을 늘리지 않는다. UI에서 미리 막는 대신
 * 서버 규칙을 그대로 노출하고 에러를 그 자리에 보여준다 —
 * "UI 편의일 뿐 인가는 서버"(RequireMember 주석) 원칙과 같다.
 */
const ASSIGNABLE_ROLES = ["MEMBER", "LEADER", "PASTOR"] as const satisfies readonly Role[];

/** 만료 시각을 "12:30까지"로 — 코드 전달 대화에서 그대로 읽어주는 용도 */
function formatExpiry(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}까지`;
}

/**
 * WIREFRAME.md §19 한 행 — 이름(접미사 그대로)·아이디·역할 + 역할 변경 /
 * 비밀번호 리셋 코드 발급(FR-ADM-08) / 계정 삭제+명단 재개방(FR-ADM-02).
 */
export function MemberRow({ member }: { member: AdminMember }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [resetCode, setResetCode] = useState<PasswordResetCode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const changeRoleMutation = useMutation({
    mutationFn: (role: Role) => api.admin.changeRole(member.id, { role }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (err) => {
      /*
       * FR-ADM-05 자기 잠금 방지 — 마지막 전도사를 강등하려 하면 서버가
       * `VALIDATION_ERROR`(field: `role`)로 거부한다. 서버 메시지에 다음
       * 행동("다른 관리자를 먼저 지정")이 들어 있으므로 그대로 노출한다.
       */
      setError(
        isApiError(err) ? err.message : "역할을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  const resetCodeMutation = useMutation({
    mutationFn: () => api.admin.issuePasswordResetCode(member.id),
    onSuccess: (code) => {
      setError(null);
      setResetCode(code);
    },
    onError: (err) => {
      // 카카오 가입자(비밀번호 없음)는 서버가 VALIDATION_ERROR로 안내를 준다 (SPEC_API §8.4)
      setError(
        isApiError(err) ? err.message : "코드를 발급하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reason: string) => api.admin.deleteMember(member.id, { reason }),
    onSuccess: () => {
      setError(null);
      setDeleting(false);
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (err) => {
      setError(
        isApiError(err) ? err.message : "계정을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.",
      );
    },
  });

  const canChangeRole = member.role !== "GUEST";

  function handleChange(next: string) {
    const role = next as Role;
    if (role === member.role) return;

    // FR-ADM-04 수용 기준 — 되돌리기 어려운 동작이므로 확인을 거친다
    const confirmed = window.confirm(
      `${member.name}님의 역할을 "${ROLE_LABEL[member.role]}" → "${ROLE_LABEL[role]}"로 변경하시겠습니까?\n\n` +
        (role === "LEADER"
          ? "임원은 예산안을 열람할 수 있게 됩니다."
          : role === "PASTOR"
            ? "전도사는 회원 관리·비밀번호 초기화까지 할 수 있게 됩니다."
            : "예산안 열람 권한이 사라집니다.") +
        "\n변경 이력은 기록됩니다.",
    );
    if (!confirmed) return;
    setError(null);
    changeRoleMutation.mutate(role);
  }

  function handleIssueResetCode() {
    // 코드는 30분 유효·1회용 — 잘못 눌러도 위험하지 않지만 발급도 감사로그에 남는다
    const confirmed = window.confirm(
      `${member.name}님의 비밀번호 재설정 코드를 발급하시겠습니까?\n발급 이력은 기록됩니다.`,
    );
    if (!confirmed) return;
    resetCodeMutation.mutate();
  }

  function handleDelete() {
    const reason = deleteReason.trim();
    if (!reason) {
      setError("삭제 사유를 입력해주세요.");
      return;
    }
    // SPEC_API §8.2 — 계정 삭제 + 명단 재개방. 선점 복구 절차의 핵심 동작이다
    const confirmed = window.confirm(
      `${member.name}님의 계정을 삭제합니다.\n\n명단이 다시 열려 본인이 재가입할 수 있게 됩니다.\n이 동작은 되돌릴 수 없습니다.`,
    );
    if (!confirmed) return;
    setError(null);
    deleteMutation.mutate(reason);
  }

  return (
    <div className="py-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* 이름은 명단의 동명이인 접미사 포함 그대로 (SPEC_API §8.1) */}
        <span className="font-bold">{member.name}</span>
        <span className="text-sm text-[var(--color-gray-400)]">
          {member.loginId ?? "(카카오)"}
        </span>
        <span className="text-sm font-bold">{ROLE_LABEL[member.role]}</span>

        <span className="ml-auto flex items-center gap-2">
          {member.loginId !== null && (
            <button
              type="button"
              onClick={handleIssueResetCode}
              disabled={resetCodeMutation.isPending}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-3 text-sm font-bold transition hover:bg-[var(--color-navy-100)] disabled:opacity-60"
            >
              {resetCodeMutation.isPending ? "발급 중..." : "비번 초기화"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setDeleting((v) => !v);
              setError(null);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] border border-[var(--color-red-500)] px-3 text-sm font-bold text-[var(--color-red-500)] transition hover:bg-[var(--color-red-500)] hover:text-white"
          >
            삭제
          </button>
          {canChangeRole && (
            <>
              <label htmlFor={`role-${member.id}`} className="sr-only">
                {member.name} 역할 변경
              </label>
              <select
                id={`role-${member.id}`}
                value={member.role}
                disabled={changeRoleMutation.isPending}
                onChange={(e) => handleChange(e.target.value)}
                className="min-h-11 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-3 text-sm font-bold focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)] disabled:opacity-60"
              >
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABEL[role]}
                  </option>
                ))}
              </select>
            </>
          )}
        </span>
      </div>

      {resetCode && (
        <div
          role="status"
          className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 text-center"
        >
          <p className="text-sm text-[var(--color-gray-400)]">{member.name}님의 재설정 코드</p>
          <p className="mt-1 font-mono text-2xl font-bold tracking-widest">{resetCode.resetCode}</p>
          <p className="mt-1 text-sm text-[var(--color-gray-400)]">
            {formatExpiry(resetCode.expiresAt)} 유효 (30분 · 1회용)
          </p>
          <p className="mt-2 text-sm">구두나 문자로 본인에게 전달하세요.</p>
          <button
            type="button"
            onClick={() => setResetCode(null)}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-5 text-sm font-bold"
          >
            닫기
          </button>
        </div>
      )}

      {deleting && (
        <div className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-red-500)] p-4">
          <p className="text-sm font-bold text-[var(--color-red-500)]">
            ⚠ 계정을 삭제하면 명단이 다시 열려 본인이 재가입할 수 있게 됩니다.
          </p>
          <label htmlFor={`delete-reason-${member.id}`} className="mt-3 mb-1 block text-sm font-bold">
            삭제 사유 (필수 — 기록에 남습니다)
          </label>
          <input
            id={`delete-reason-${member.id}`}
            type="text"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
            placeholder="예: 본인 확인 — 선점 계정 삭제"
            className="min-h-11 w-full rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
          />
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleting(false)}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-5 text-sm font-bold"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-red-500)] px-5 text-sm font-bold text-white disabled:opacity-60"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-[var(--color-red-500)]">
          {error}
        </p>
      )}
    </div>
  );
}
