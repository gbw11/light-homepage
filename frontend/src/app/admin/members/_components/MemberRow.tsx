"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { AdminMember, Role } from "@/types/api";

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

/**
 * WIREFRAME.md §19 전체 탭의 한 행 — 이름·마을·역할 + 역할 변경 드롭다운
 * (FR-ADM-03/04, SPEC_API §8.4).
 */
export function MemberRow({ member }: { member: AdminMember }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const changeRoleMutation = useMutation({
    mutationFn: (role: Role) => api.admin.changeRole(member.id, { role }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "members"] });
    },
    onError: (err) => {
      /*
       * FR-ADM-05 자기 잠금 방지 — 마지막 전도사를 강등하려 하면 서버가
       * `VALIDATION_ERROR`(field: `role`)로 거부한다. 이 화면이 그 메시지를
       * 그대로 보여주지 않으면 "드롭다운을 바꿨는데 아무 일도 안 일어난다"가
       * 된다. 서버 메시지에 다음 행동("다른 관리자를 먼저 지정")이 들어
       * 있으므로 그대로 노출한다.
       */
      setError(
        isApiError(err) ? err.message : "역할을 변경하지 못했습니다. 잠시 후 다시 시도해주세요.",
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
          ? "임원은 회의록·예산안을 열람할 수 있게 됩니다."
          : role === "PASTOR"
            ? "전도사는 회원 승인·역할 변경까지 할 수 있게 됩니다."
            : "회의록·예산안 열람 권한이 사라집니다.") +
        "\n변경 이력은 기록됩니다.",
    );
    if (!confirmed) return;
    setError(null);
    changeRoleMutation.mutate(role);
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

        <span className="ml-auto">
          {canChangeRole ? (
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
          ) : (
            <span aria-hidden className="text-sm text-[var(--color-gray-400)]">
              —
            </span>
          )}
        </span>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-[var(--color-red-500)]">
          {error}
        </p>
      )}
    </div>
  );
}
