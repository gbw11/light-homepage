"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { villageLabel } from "@/lib/village";

const PAGE_SIZE = 20;

/** `2026-08-24T12:03:00Z` → `8/24 21:03` (현지 시각) */
function formatViewedAt(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 월례회 열람 기록 `/admin/meetings/[id]/views`
 * (SPEC_API §7.7 · WIREFRAME §21-2, 권한 `L`).
 *
 * ⚠️ **이 화면은 회원 개인정보를 모아 보여준다** — 누가, 언제, 몇 페이지까지
 * 봤는지. 용도는 하나뿐이다: 자료가 유출됐을 때 캡처에 박힌 워터마크와
 * 대조해 어느 열람본에서 나갔는지 좁히는 것. 평소에 누가 뭘 보는지
 * 들여다보는 화면이 아니라는 걸 화면 안에도 적어둔다 — 적지 않으면
 * 그렇게 쓰이게 된다.
 */
export function MeetingViewLog({ id }: { id: string }) {
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error, isPlaceholderData } = useQuery({
    queryKey: ["meetings", "views", id, page],
    queryFn: () => api.meetings.views(id, { page, size: PAGE_SIZE }),
    retry: false,
    // 페이지를 넘길 때 목록이 통째로 사라졌다 나타나지 않게 이전 값을 잠시 유지한다
    placeholderData: (prev) => prev,
  });

  if (isLoading) {
    return (
      <Section>
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError || !data) {
    const missing =
      isApiError(error) && (error.code === "NOT_FOUND" || error.code === "FORBIDDEN");
    return (
      <Section>
        <p role="alert" className="text-[var(--color-red-500)]">
          {missing ? "찾을 수 없는 자료입니다." : "열람 기록을 불러오지 못했습니다."}
        </p>
        <BackLink id={id} />
      </Section>
    );
  }

  return (
    <Section>
      <BackLink id={id} />
      <h1 className="mt-2 text-2xl font-bold md:text-3xl">열람 기록</h1>
      <p className="mt-2 text-sm text-[var(--color-gray-400)]">
        총 {data.totalViewers}명이 열람했습니다.
      </p>

      <p className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-navy-100)] p-4 text-sm text-[var(--color-gray-400)]">
        자료가 밖으로 나갔을 때 캡처에 찍힌 워터마크와 대조하기 위한 기록입니다.
        회원의 개인정보이므로 그 목적 밖으로 옮기거나 공유하지 말아 주세요.
      </p>

      {data.items.length === 0 ? (
        <p className="mt-8 text-[var(--color-gray-400)]">아직 아무도 열람하지 않았습니다.</p>
      ) : (
        <>
          {/*
            표로 만든다 — 이름·마을·시각·페이지가 열로 대응되는 데이터라서
            스크린리더 사용자가 "3번째 사람의 마지막 페이지"를 짚을 수 있어야 한다.
          */}
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-navy-100)] text-[var(--color-gray-400)]">
                  <th scope="col" className="py-2 pr-4 font-bold">
                    이름
                  </th>
                  <th scope="col" className="py-2 pr-4 font-bold">
                    마을
                  </th>
                  <th scope="col" className="py-2 pr-4 font-bold">
                    마지막 열람
                  </th>
                  <th scope="col" className="py-2 font-bold">
                    본 페이지
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((v, index) => (
                  <tr
                    // 서버가 행 id를 주지 않는다 (§7.7). 이름+시각 조합이면
                    // 같은 페이지 안에서 충분히 구분된다
                    key={`${v.memberName}-${v.lastViewedAt}-${index}`}
                    className="border-b border-[var(--color-navy-100)]"
                  >
                    <td className="py-3 pr-4 font-bold">{v.memberName}</td>
                    <td className="py-3 pr-4 text-[var(--color-gray-400)]">
                      {villageLabel(v.village)}
                    </td>
                    <td className="py-3 pr-4 text-[var(--color-gray-400)]">
                      {formatViewedAt(v.lastViewedAt)}
                    </td>
                    <td className="py-3 text-[var(--color-gray-400)]">{v.maxPageNo}p</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {(page > 0 || data.hasNext) && (
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                disabled={page === 0 || isPlaceholderData}
                className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)] disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                ← 이전
              </button>
              <span className="text-sm text-[var(--color-gray-400)]">{page + 1}쪽</span>
              <button
                type="button"
                disabled={!data.hasNext || isPlaceholderData}
                className="inline-flex min-h-11 items-center rounded-[var(--radius-button)] border border-[var(--color-navy-100)] px-4 text-sm font-bold transition hover:bg-[var(--color-navy-100)] disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

function BackLink({ id }: { id: string }) {
  return (
    <Link
      href={`/admin/meetings/${id}`}
      className="text-sm font-bold text-[var(--color-gray-400)] hover:text-[var(--color-ink)]"
    >
      ← 자료 관리
    </Link>
  );
}
