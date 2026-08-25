"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import type { AdminMember } from "@/types/api";
import { MemberRow } from "./MemberRow";
import { PendingMemberCard } from "./PendingMemberCard";

type Tab = "PENDING" | "ALL";

const TABS = [
  { status: "PENDING", label: "승인 대기" },
  { status: "ALL", label: "전체" },
] as const satisfies readonly { status: Tab; label: string }[];

/** "8/19 신청" (WIREFRAME.md §19) — 연도는 목록에서 노이즈라 뺀다 */
export function formatApplyDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * WIREFRAME.md §19 — 회원 관리 `/admin/members` (FR-ADM-02/03/04).
 *
 * 탭 전환은 URL을 바꾸지 않는다 (`/my/documents`와 같은 판단 — 권한 있는
 * 사람만 보는 목록은 공유·북마크 대상이 아니다).
 *
 * 검색은 **제출 시점에만** 서버로 보낸다. 입력마다 쿼리를 날리면 §8.1을
 * 타이핑 한 글자당 한 번씩 호출하게 되고, 이 화면은 개인정보를 다루므로
 * 불필요한 조회 자체를 줄이는 편이 낫다.
 */
export function MemberBoard() {
  const [tab, setTab] = useState<Tab>("PENDING");

  return (
    <>
      <section className="mx-auto w-full max-w-[var(--container-max)] px-5 md:px-10">
        <div
          className="mt-6 flex gap-2 border-b border-[var(--color-navy-100)]"
          role="tablist"
          aria-label="회원 목록 구분"
        >
          {TABS.map((t) => {
            const active = t.status === tab;
            return (
              <button
                key={t.status}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.status)}
                className={
                  active
                    ? "border-b-2 border-[var(--color-navy-900)] px-4 py-3 text-sm font-bold"
                    : "px-4 py-3 text-sm font-bold text-[var(--color-gray-400)]"
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </section>

      {tab === "PENDING" ? <PendingList /> : <AllList />}
    </>
  );
}

/** 로딩/에러/빈 상태를 두 탭이 같은 문구로 처리한다 (COMPONENTS.md §3) */
function useMemberQuery(status: Tab, q: string) {
  return useQuery({
    queryKey: ["admin", "members", status, q],
    queryFn: () => api.admin.members({ status, q: q || undefined }),
  });
}

function QueryStates({
  isLoading,
  error,
}: {
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) {
    return <p className="text-[var(--color-gray-400)]">불러오는 중...</p>;
  }
  // UI 게이트를 통과했어도 최종 판단은 서버다 (SPEC_API §8.1은 `T` 전용)
  const forbidden = isApiError(error) && error.code === "FORBIDDEN";
  return (
    <p role="alert" className="text-[var(--color-red-500)]">
      {forbidden
        ? "회원 목록을 볼 권한이 없습니다. 회원 관리는 전도사님만 이용할 수 있습니다."
        : isApiError(error)
          ? error.message
          : "목록을 불러오지 못했습니다."}
    </p>
  );
}

function PendingList() {
  const { data, isLoading, isError, error } = useMemberQuery("PENDING", "");

  if (isLoading || isError) {
    return (
      <Section className="pt-8">
        <QueryStates isLoading={isLoading} error={error} />
      </Section>
    );
  }

  const items: AdminMember[] = data?.items ?? [];

  return (
    <Section className="pt-8">
      <p className="mb-4 text-sm font-bold text-[var(--color-gray-400)]">
        승인 대기 {items.length}명
      </p>
      {items.length === 0 ? (
        <p className="text-[var(--color-gray-400)]">승인 대기 중인 신청이 없습니다.</p>
      ) : (
        <ul className="space-y-4">
          {items.map((member) => (
            <li key={member.id}>
              <PendingMemberCard member={member} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function AllList() {
  // 입력 중인 값과 실제 조회에 쓰는 값을 분리한다 (제출 시점에만 조회)
  const [input, setInput] = useState("");
  const [q, setQ] = useState("");
  const { data, isLoading, isError, error } = useMemberQuery("ALL", q);

  const items: AdminMember[] = data?.items ?? [];

  return (
    <Section className="pt-8">
      <form
        role="search"
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(input.trim());
        }}
      >
        <label htmlFor="member-search" className="sr-only">
          이름 검색
        </label>
        <input
          id="member-search"
          type="search"
          placeholder="이름 검색"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="min-h-11 w-full max-w-xs rounded-[var(--radius-card)] border border-[var(--color-navy-100)] bg-transparent px-4 text-base focus:border-[var(--color-yellow)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-yellow)]"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[var(--radius-button)] bg-[var(--color-navy-100)] px-5 text-base font-bold transition hover:brightness-95"
        >
          🔍 검색
        </button>
      </form>

      {isLoading || isError ? (
        <QueryStates isLoading={isLoading} error={error} />
      ) : items.length === 0 ? (
        <p className="text-[var(--color-gray-400)]">
          {q ? `"${q}"와 일치하는 회원이 없습니다.` : "회원이 없습니다."}
        </p>
      ) : (
        <>
          <p className="mb-2 text-sm font-bold text-[var(--color-gray-400)]">
            전체 {items.length}명
          </p>
          <ul className="divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
            {items.map((member) => (
              <li key={member.id}>
                <MemberRow member={member} />
              </li>
            ))}
          </ul>
        </>
      )}

      {/* WIREFRAME.md §19 — 역할의 의미를 알려주지 않으면 임원 부여의 결과를 모른다 */}
      <p className="mt-6 text-sm text-[var(--color-gray-400)]">
        ⓘ 임원은 회의록·예산안까지 볼 수 있습니다.
      </p>
    </Section>
  );
}
