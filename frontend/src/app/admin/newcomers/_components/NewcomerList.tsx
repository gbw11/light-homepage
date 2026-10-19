"use client";

import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { Section } from "@/components/ui/Section";
import { LoadMoreButton } from "@/components/ui/LoadMoreButton";
import type { Gender, NewcomerRecord, Referrer } from "@/types/api";

/** 라벨은 `/welcome/register` 폼의 선택지와 같은 문구를 쓴다 (같은 데이터다) */
const GENDER_LABEL: Record<Gender, string> = { MALE: "남", FEMALE: "여" };

const REFERRER_LABEL: Record<Referrer, string> = {
  FRIEND: "지인 소개",
  SEARCH: "검색",
  SNS: "SNS",
  ETC: "기타",
};

/** "8/19" (WIREFRAME.md §20) */
function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 선택 항목이 비어 있을 수 있다 (`/welcome/register`가 성별·유입경로를
 * 필수로 받지 않는다). 채워진 것만 `·`로 이어 붙인다 — 빈 값을 "—"로
 * 늘어놓으면 실제로 채워진 정보가 묻힌다.
 *
 * 생년월일은 필수지만 2026-10-19 이전 신청은 `null`이다 (그때는 나이대를
 * 받았다, SPEC_API §8.6) — 그래서 여기서도 비어 있을 수 있는 칸으로 다룬다.
 */
function metaLine(record: NewcomerRecord): string {
  const parts = [
    record.phone,
    record.birthDate,
    record.gender ? GENDER_LABEL[record.gender] : null,
    record.referrer ? REFERRER_LABEL[record.referrer] : null,
  ].filter((v): v is string => Boolean(v));
  return parts.join(" · ");
}

/**
 * WIREFRAME.md §20 — 새가족 등록 내역 (FR-ADM-07, SPEC_API §8.6).
 * 권한은 `L` 이상이다 (회원 관리와 달리 전도사 전용이 아니다).
 */
export function NewcomerList() {
  // 보관 기간이 1년이라 금방 20건을 넘는다 — 21번째부터는 "더 보기" (점검 🟠-5)
  const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["admin", "newcomers"],
      queryFn: ({ pageParam }) => api.admin.newcomers({ page: pageParam }),
      initialPageParam: 0,
      getNextPageParam: (last) => (last.hasNext ? last.page + 1 : undefined),
    });

  /*
    헤더 알림에서 `#newcomer-{id}`로 들어온 경우 그 신청으로 내려가 잠시 강조한다
    (SPEC_API §14.5-2 "refId로 §8.6 목록의 해당 항목으로 이동"). 목록이 클라이언트에서
    늦게 그려지므로 브라우저 기본 해시 스크롤이 닿지 않는다 — 데이터가 온 뒤 직접 한다.

    찾는 신청이 아직 안 불러온 페이지에 있으면 다음 페이지를 더 불러온다 — 알림은
    최근 20건까지 보여주므로(§14.1) 첫 페이지 밖의 신청을 가리킬 수 있다.
  */
  const [highlighted, setHighlighted] = useState<string | null>(null);
  // 한 번 찾아갔으면 끝 — 이후 "더 보기"로 목록이 늘 때마다 다시 끌려 올라가지 않게
  const jumpedRef = useRef(false);
  useEffect(() => {
    if (!data || jumpedRef.current) return;
    const match = /^#newcomer-(.+)$/.exec(window.location.hash);
    if (!match) return;
    const id = decodeURIComponent(match[1]);
    const el = document.getElementById(`newcomer-${id}`);
    if (!el) {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
      return;
    }
    jumpedRef.current = true;
    el.scrollIntoView({ block: "center" });
    const start = window.setTimeout(() => setHighlighted(id), 0);
    return () => window.clearTimeout(start);
  }, [data, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // 강조는 잠깐만 — 위 effect와 떼어 둬야 목록이 늘어도 꺼지는 타이머가 취소되지 않는다
  useEffect(() => {
    if (!highlighted) return;
    const end = window.setTimeout(() => setHighlighted(null), 2500);
    return () => window.clearTimeout(end);
  }, [highlighted]);

  if (isLoading) {
    return (
      <Section className="pt-8">
        <p className="text-[var(--color-gray-400)]">불러오는 중...</p>
      </Section>
    );
  }

  if (isError) {
    // UI 게이트를 통과했어도 최종 판단은 서버다 (SPEC_API §8.6은 `L` 이상)
    const forbidden = isApiError(error) && error.code === "FORBIDDEN";
    return (
      <Section className="pt-8">
        <p role="alert" className="text-[var(--color-red-500)]">
          {forbidden
            ? "새가족 등록 내역을 볼 권한이 없습니다."
            : isApiError(error)
              ? error.message
              : "목록을 불러오지 못했습니다."}
        </p>
      </Section>
    );
  }

  const items: NewcomerRecord[] = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Section className="pt-8">
      {items.length === 0 ? (
        <p className="text-[var(--color-gray-400)]">등록된 새가족 신청이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[var(--color-navy-100)] border-y border-[var(--color-navy-100)]">
          {items.map((record) => (
            <li
              key={record.id}
              id={`newcomer-${record.id}`}
              className={`scroll-mt-24 py-4 transition-colors ${
                highlighted === record.id ? "bg-[var(--color-navy-100)]" : ""
              }`}
            >
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-sm text-[var(--color-gray-400)]">
                  {formatDate(record.createdAt)}
                </span>
                <span className="font-bold">{record.name}</span>
                <span className="text-sm text-[var(--color-gray-400)]">{metaLine(record)}</span>
              </p>
              {record.message && (
                <p className="mt-2 text-sm">&ldquo;{record.message}&rdquo;</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <LoadMoreButton
        hasNextPage={hasNextPage}
        isFetching={isFetchingNextPage}
        onClick={() => fetchNextPage()}
      />
    </Section>
  );
}
